import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, HarSummaryResponse, NormalizedEntry } from '@har-comparisor/shared';
import { buildApp } from './app.js';
import type { ServerConfig } from './config.js';
import { harToBuffer, makeEntry, makeHar } from './har/har-builder.test-util.js';

const baseConfig: ServerConfig = {
  port: 0,
  host: '127.0.0.1',
  maxUploadBytes: 1024 * 1024,
  sessionTtlMs: 60_000,
  maxSessions: 5,
  clientDistDir: '/this/folder/does/not/exist',
};

let app: FastifyInstance | undefined;

async function start(overrides: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  app = await buildApp({ ...baseConfig, ...overrides });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function upload(instance: FastifyInstance, payload: Buffer | string, fileName?: string) {
  return instance.inject({
    method: 'POST',
    url: '/api/hars',
    payload,
    headers: {
      'content-type': 'application/octet-stream',
      ...(fileName ? { 'x-file-name': encodeURIComponent(fileName) } : {}),
    },
  });
}

describe('API', () => {
  it('answers the health check', async () => {
    const instance = await start();
    const response = await instance.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('uploads a HAR and lists its entries', async () => {
    const instance = await start();
    const har = makeHar([makeEntry(), makeEntry({ method: 'POST', url: 'https://x.test/a' })]);
    const response = await upload(instance, harToBuffer(har), 'legacy run.har');

    expect(response.statusCode).toBe(201);
    const body = response.json<HarSummaryResponse>();
    expect(body.fileName).toBe('legacy run.har');
    expect(body.entryCount).toBe(2);
    expect(body.entries.map((e) => e.method)).toEqual(['GET', 'POST']);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts a JSON content type as raw bytes', async () => {
    const instance = await start();
    const response = await instance.inject({
      method: 'POST',
      url: '/api/hars',
      payload: harToBuffer(makeHar()),
      headers: { 'content-type': 'application/json' },
    });
    expect(response.statusCode).toBe(201);
  });

  it('returns the same summary when the HAR is read again', async () => {
    const instance = await start();
    const created = (await upload(instance, harToBuffer(makeHar()))).json<HarSummaryResponse>();
    const read = await instance.inject({ method: 'GET', url: `/api/hars/${created.id}` });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual(created);
  });

  it('returns the full normalized entry', async () => {
    const instance = await start();
    const created = (await upload(instance, harToBuffer(makeHar()))).json<HarSummaryResponse>();
    const response = await instance.inject({
      method: 'GET',
      url: `/api/hars/${created.id}/entries/0`,
    });
    expect(response.statusCode).toBe(200);
    const entry = response.json<NormalizedEntry>();
    expect(entry.request.path).toBe('/items');
    expect(entry.response.body?.text).toBe('{"ok":true}');
  });

  it('reports clear errors for bad uploads', async () => {
    const instance = await start();

    const empty = await instance.inject({ method: 'POST', url: '/api/hars' });
    expect(empty.statusCode).toBe(400);
    expect(empty.json<ApiErrorBody>().error.code).toBe('EMPTY_FILE');

    const notJson = await upload(instance, 'hello');
    expect(notJson.statusCode).toBe(400);
    expect(notJson.json<ApiErrorBody>().error.code).toBe('INVALID_JSON');

    const notHar = await upload(instance, '{"a":1}');
    expect(notHar.statusCode).toBe(400);
    expect(notHar.json<ApiErrorBody>().error.code).toBe('NOT_A_HAR');
  });

  it('rejects files above the size limit', async () => {
    const instance = await start({ maxUploadBytes: 200 });
    const response = await upload(instance, harToBuffer(makeHar()));
    expect(response.statusCode).toBe(413);
    expect(response.json<ApiErrorBody>().error.code).toBe('FILE_TOO_LARGE');
  });

  it('returns 404 for unknown HARs, entries and routes', async () => {
    const instance = await start();
    const created = (await upload(instance, harToBuffer(makeHar()))).json<HarSummaryResponse>();

    const unknownHar = await instance.inject({ method: 'GET', url: '/api/hars/nope' });
    expect(unknownHar.statusCode).toBe(404);
    expect(unknownHar.json<ApiErrorBody>().error.code).toBe('HAR_NOT_FOUND');

    const unknownEntry = await instance.inject({
      method: 'GET',
      url: `/api/hars/${created.id}/entries/99`,
    });
    expect(unknownEntry.statusCode).toBe(404);
    expect(unknownEntry.json<ApiErrorBody>().error.code).toBe('ENTRY_NOT_FOUND');

    const badIndex = await instance.inject({
      method: 'GET',
      url: `/api/hars/${created.id}/entries/abc`,
    });
    expect(badIndex.statusCode).toBe(400);

    const unknownRoute = await instance.inject({ method: 'GET', url: '/api/nothing' });
    expect(unknownRoute.statusCode).toBe(404);
    expect(unknownRoute.json<ApiErrorBody>().error.code).toBe('NOT_FOUND');
  });

  it('deletes a HAR', async () => {
    const instance = await start();
    const created = (await upload(instance, harToBuffer(makeHar()))).json<HarSummaryResponse>();
    const deleted = await instance.inject({ method: 'DELETE', url: `/api/hars/${created.id}` });
    expect(deleted.statusCode).toBe(204);
    const read = await instance.inject({ method: 'GET', url: `/api/hars/${created.id}` });
    expect(read.statusCode).toBe(404);
  });
});
