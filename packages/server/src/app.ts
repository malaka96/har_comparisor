import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@har-comparisor/shared';
import type { ServerConfig } from './config.js';
import { HarError } from './har/har-error.js';
import { registerHarRoutes } from './routes/hars.js';
import { registerReportRoutes } from './routes/report.js';
import { HarStore } from './store/har-store.js';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  EMPTY_FILE: 400,
  INVALID_JSON: 400,
  NOT_A_HAR: 400,
  BAD_REQUEST: 400,
  FILE_TOO_LARGE: 413,
  HAR_NOT_FOUND: 404,
  ENTRY_NOT_FOUND: 404,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

function errorBody(code: ErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] === undefined,
    bodyLimit: config.maxUploadBytes,
  });

  const store = new HarStore({ ttlMs: config.sessionTtlMs, maxSessions: config.maxSessions });
  store.startCleanup();
  app.addHook('onClose', async () => store.stopCleanup());

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HarError) {
      return reply.code(STATUS_BY_CODE[error.code]).send(errorBody(error.code, error.message));
    }
    const fastifyCode = (error as { code?: string }).code;
    if (fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      const limitMb = Math.round(config.maxUploadBytes / 1024 / 1024);
      return reply
        .code(413)
        .send(
          errorBody(ERROR_CODES.FILE_TOO_LARGE, `The file is larger than the ${limitMb} MB limit.`),
        );
    }
    request.log.error(error);
    return reply
      .code(500)
      .send(errorBody(ERROR_CODES.INTERNAL, 'Something went wrong while handling the request.'));
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorBody(ERROR_CODES.NOT_FOUND, 'Not found.'));
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  registerHarRoutes(app, store);
  registerReportRoutes(app, store);

  if (existsSync(config.clientDistDir)) {
    await app.register(fastifyStatic, { root: config.clientDistDir });
  }

  return app;
}
