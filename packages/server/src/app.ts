import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { ServerConfig } from './config.js';

export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env['NODE_ENV'] !== 'test',
    bodyLimit: config.maxUploadBytes,
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  if (existsSync(config.clientDistDir)) {
    await app.register(fastifyStatic, { root: config.clientDistDir });
  }

  return app;
}
