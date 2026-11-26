import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, HarSummaryResponse, Report } from '@har-comparisor/shared';
import { buildApp } from '../app.js';
import { harToBuffer, makeEntry, makeHar } from '../har/har-builder.test-util.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(): Promise<FastifyInstance> {
  app = await buildApp({
    port: 0,
    host: '127.0.0.1',
    maxUploadBytes: 1024 * 1024,
    sessionTtlMs: 60_000,
    maxSessions: 5,
    clientDistDir: '/this/folder/does/not/exist',
  });
  return app;
}

async function upload(instance: FastifyInstance, har: unknown, fileName: string) {
  const response = await instance.inject({
    method: 'POST',
    url: '/api/hars',
    payload: harToBuffer(har),
    headers: { 'content-type': 'application/octet-stream', 'x-file-name': fileName },
  });
  return response.json<HarSummaryResponse>();
}

/** Two small HARs: one identical pair, one pair with a changed secret header and body field. */
async function loadPairOfHars(instance: FastifyInstance) {
  const legacy = await upload(
    instance,
    makeHar([
      makeEntry({ url: 'https://api.test/items' }),
      makeEntry({
        method: 'POST',
        url: 'https://api.test/login?token=t-legacy&page=1',
        requestHeaders: [{ name: 'Authorization', value: 'Bearer legacy-secret' }],
        requestBody: { mimeType: 'application/json', text: '{"user":"ann","password":"p1"}' },
      }),
      makeEntry({ url: 'https://api.test/only-legacy' }),
    ]),
    'legacy.har',
  );
  const next = await upload(
    instance,
    makeHar([
      makeEntry({ url: 'https://api.test/items' }),
      makeEntry({
        method: 'POST',
        url: 'https://api.test/login?token=t-new&page=1',
        requestHeaders: [{ name: 'Authorization', value: 'Bearer new-secret' }],
        requestBody: { mimeType: 'application/json', text: '{"user":"bob","password":"p2"}' },
      }),
    ]),
    'new.har',
  );
  return { legacy, next };
}

function requestReport(instance: FastifyInstance, body: unknown) {
  return instance.inject({
    method: 'POST',
    url: '/api/report',
    payload: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/report', () => {
  it('builds a JSON report of the pairs, with secrets redacted by default', async () => {
    const instance = await start();
    const { legacy, next } = await loadPairOfHars(instance);
    const response = await requestReport(instance, {
      legacyHar: legacy.id,
      newHar: next.id,
      format: 'json',
      pairs: [
        { number: 1, legacy: 0, new: 0, outOfOrder: false },
        { number: 2, legacy: 1, new: 1, outOfOrder: true },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="har-report_legacy_vs_new.json"',
    );
    const report = response.json<Report>();
    expect(report.redacted).toBe(true);
    expect(report.summary).toEqual({
      pairs: 2,
      identical: 1,
      different: 1,
      headerDifferences: 1,
      outOfOrder: 1,
      missing: 1,
      extra: 0,
    });
    expect(report.missing.map((r) => r.url)).toEqual(['/only-legacy']);
    for (const secret of ['legacy-secret', 'new-secret', 'p1', 'p2', 't-legacy', 't-new']) {
      expect(response.body).not.toContain(secret);
    }
    // Values that are not secret stay readable.
    expect(response.body).toContain('ann');
    expect(response.body).toContain('page=1');
  });

  it('keeps secrets when redaction is turned off', async () => {
    const instance = await start();
    const { legacy, next } = await loadPairOfHars(instance);
    const response = await requestReport(instance, {
      legacyHar: legacy.id,
      newHar: next.id,
      format: 'text',
      redact: false,
      pairs: [{ number: 1, legacy: 1, new: 1, outOfOrder: false }],
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-disposition']).toContain('.txt"');
    expect(response.body).toContain('Bearer legacy-secret');
    expect(response.body).toContain('#1 DIFFERENT');
  });

  it('returns a self-contained HTML page', async () => {
    const instance = await start();
    const { legacy, next } = await loadPairOfHars(instance);
    const response = await requestReport(instance, {
      legacyHar: legacy.id,
      newHar: next.id,
      format: 'html',
      pairs: [],
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toMatch(/^<!doctype html>/);
    expect(response.body).not.toContain('<script');
  });

  it.each([
    ['not JSON', '{oops', 'not valid JSON'],
    ['an unknown format', { legacyHar: 'a', newHar: 'b', format: 'pdf', pairs: [] }, 'format'],
    ['missing pairs', { legacyHar: 'a', newHar: 'b', format: 'json' }, 'pairs'],
    [
      'a bad pair',
      { legacyHar: 'a', newHar: 'b', format: 'json', pairs: [{ number: 1, legacy: -1, new: 0 }] },
      'Each pair',
    ],
    [
      'a request in two pairs',
      {
        legacyHar: 'a',
        newHar: 'b',
        format: 'json',
        pairs: [
          { number: 1, legacy: 0, new: 0 },
          { number: 2, legacy: 0, new: 1 },
        ],
      },
      'only one pair',
    ],
  ])('rejects %s', async (_label, body, message) => {
    const instance = await start();
    const response = await requestReport(instance, body);
    expect(response.statusCode).toBe(400);
    const error = response.json<ApiErrorBody>().error;
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toContain(message);
  });

  it('answers 404 for an unknown HAR or entry', async () => {
    const instance = await start();
    const { legacy, next } = await loadPairOfHars(instance);
    const unknownHar = await requestReport(instance, {
      legacyHar: 'nope',
      newHar: next.id,
      format: 'json',
      pairs: [],
    });
    expect(unknownHar.statusCode).toBe(404);
    expect(unknownHar.json<ApiErrorBody>().error.code).toBe('HAR_NOT_FOUND');

    const unknownEntry = await requestReport(instance, {
      legacyHar: legacy.id,
      newHar: next.id,
      format: 'json',
      pairs: [{ number: 1, legacy: 0, new: 9 }],
    });
    expect(unknownEntry.statusCode).toBe(404);
    expect(unknownEntry.json<ApiErrorBody>().error.code).toBe('ENTRY_NOT_FOUND');
  });
});
