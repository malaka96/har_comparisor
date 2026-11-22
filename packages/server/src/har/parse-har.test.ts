import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@har-comparisor/shared';
import { HarError } from './har-error.js';
import { harToBuffer, makeEntry, makeHar } from './har-builder.test-util.js';
import { parseHar } from './parse-har.js';
import { summarizeEntry } from './summarize.js';

function expectHarError(action: () => unknown, code: string, messagePart?: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(HarError);
    expect((error as HarError).code).toBe(code);
    if (messagePart) expect((error as HarError).message).toContain(messagePart);
    return;
  }
  throw new Error('Expected parseHar to throw');
}

describe('parseHar: valid files', () => {
  it('reads metadata and normalizes a simple entry', () => {
    const parsed = parseHar(harToBuffer(makeHar()));

    expect(parsed.harVersion).toBe('1.2');
    expect(parsed.creator).toBe('WebInspector 537.36');
    expect(parsed.pageCount).toBe(1);
    expect(parsed.entryCount).toBe(1);
    expect(parsed.warnings).toEqual([]);

    const entry = parsed.entries[0]!;
    expect(entry.index).toBe(0);
    expect(entry.request.method).toBe('GET');
    expect(entry.request.host).toBe('api.example.test');
    expect(entry.request.path).toBe('/items');
    expect(entry.request.scheme).toBe('https');
    expect(entry.request.query).toEqual([
      { name: 'page', value: '1' },
      { name: 'sort', value: 'name' },
    ]);
    expect(entry.response.status).toBe(200);
    expect(entry.response.body?.text).toBe('{"ok":true}');
    expect(entry.resourceType).toBe('xhr');
    expect(entry.timings.wait).toBe(10);
  });

  it('drops browser-only fields such as _initiator', () => {
    const big = { type: 'script', stack: { callFrames: new Array(50).fill({ url: 'x' }) } };
    const parsed = parseHar(harToBuffer(makeHar([makeEntry({ extra: { _initiator: big } })])));
    expect(JSON.stringify(parsed.entries[0])).not.toContain('callFrames');
  });

  it('accepts a string and a file with a byte order mark', () => {
    const text = `\uFEFF${JSON.stringify(makeHar())}`;
    expect(parseHar(text).entries).toHaveLength(1);
  });

  it('keeps the original index of entries', () => {
    const parsed = parseHar(
      harToBuffer(makeHar([makeEntry(), makeEntry({ url: 'not a url' }), makeEntry()])),
    );
    expect(parsed.entries.map((e) => e.index)).toEqual([0, 2]);
  });

  it('reads an empty entry list', () => {
    const parsed = parseHar(harToBuffer(makeHar([])));
    expect(parsed.entries).toEqual([]);
    expect(parsed.entryCount).toBe(0);
  });

  it('uppercases the method and reads the request body', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([
          makeEntry({
            method: 'post',
            requestBody: { mimeType: 'application/json', text: '{"a":1}' },
          }),
        ]),
      ),
    );
    const entry = parsed.entries[0]!;
    expect(entry.request.method).toBe('POST');
    expect(entry.request.body).toEqual({ mimeType: 'application/json', text: '{"a":1}' });
  });

  it('reads form parameters when no body text is recorded', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([
          makeEntry({
            method: 'POST',
            requestBody: {
              mimeType: 'application/x-www-form-urlencoded',
              params: [{ name: 'a', value: '1' }],
            },
          }),
        ]),
      ),
    );
    expect(parsed.entries[0]!.request.body?.params).toEqual([{ name: 'a', value: '1' }]);
  });
});

describe('parseHar: edge cases', () => {
  it('keeps Base64 bodies and marks them', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([
          makeEntry({
            responseBody: {
              mimeType: 'image/png',
              text: 'iVBORw0KGgo=',
              encoding: 'base64',
              size: 8,
            },
          }),
        ]),
      ),
    );
    expect(parsed.entries[0]!.response.body).toEqual({
      mimeType: 'image/png',
      text: 'iVBORw0KGgo=',
      encoding: 'base64',
      size: 8,
    });
  });

  it('treats a response without body text and size 0 as having no body', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([makeEntry({ status: 204, responseBody: { mimeType: 'text/plain', size: 0 } })]),
      ),
    );
    const entry = parsed.entries[0]!;
    expect(entry.response.status).toBe(204);
    expect(entry.response.body).toBeUndefined();
    expect(summarizeEntry(entry).hasResponseBody).toBe(false);
  });

  it('keeps a body with a size but no text (browser did not record the text)', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([makeEntry({ responseBody: { mimeType: 'application/json', size: 500 } })]),
      ),
    );
    expect(parsed.entries[0]!.response.body).toEqual({ mimeType: 'application/json', size: 500 });
  });

  it('reads a failed request with status 0', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([makeEntry({ status: 0, statusText: '', responseBody: { mimeType: '' } })]),
      ),
    );
    expect(parsed.entries[0]!.response.status).toBe(0);
    expect(parsed.warnings).toEqual([]);
  });

  it('uses status 0 and warns when the response is missing', () => {
    const entry = makeEntry();
    delete entry['response'];
    const parsed = parseHar(harToBuffer(makeHar([entry])));
    expect(parsed.entries[0]!.response.status).toBe(0);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]!.entryIndex).toBe(0);
    expect(parsed.warnings[0]!.message).toContain('no response');
  });

  it('skips entries without a readable request and reports them', () => {
    const noUrl = makeEntry();
    noUrl['request'] = { method: 'GET' };
    const badUrl = makeEntry({ url: 'not a url' });
    const noRequest = makeEntry();
    delete noRequest['request'];
    const parsed = parseHar(
      harToBuffer(
        makeHar([
          noUrl,
          badUrl,
          noRequest,
          'oops' as unknown as Record<string, unknown>,
          makeEntry(),
        ]),
      ),
    );

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entryCount).toBe(5);
    expect(parsed.warnings.map((w) => w.entryIndex)).toEqual([0, 1, 2, 3]);
    for (const warning of parsed.warnings) expect(warning.message).toContain('skipped');
  });

  it('tolerates headers that are not lists', () => {
    const entry = makeEntry();
    (entry['request'] as Record<string, unknown>)['headers'] = 'broken';
    const parsed = parseHar(harToBuffer(makeHar([entry])));
    expect(parsed.entries[0]!.request.headers).toEqual([]);
  });

  it('warns when the version is missing', () => {
    const parsed = parseHar(harToBuffer(makeHar([makeEntry()], { version: undefined })));
    expect(parsed.warnings.some((w) => w.message.includes('version'))).toBe(true);
  });

  it('keeps empty-string bodies distinct from missing bodies', () => {
    const parsed = parseHar(
      harToBuffer(makeHar([makeEntry({ responseBody: { mimeType: 'text/plain', text: '' } })])),
    );
    expect(parsed.entries[0]!.response.body?.text).toBe('');
  });
});

describe('parseHar: invalid input', () => {
  it('rejects an empty file', () => {
    expectHarError(() => parseHar(Buffer.alloc(0)), ERROR_CODES.EMPTY_FILE);
    expectHarError(() => parseHar('   \n '), ERROR_CODES.EMPTY_FILE);
  });

  it('rejects text that is not JSON', () => {
    expectHarError(() => parseHar('hello world'), ERROR_CODES.INVALID_JSON, 'not valid JSON');
  });

  it('rejects JSON that is not a HAR', () => {
    expectHarError(() => parseHar('[]'), ERROR_CODES.NOT_A_HAR, '"log"');
    expectHarError(() => parseHar('{"a":1}'), ERROR_CODES.NOT_A_HAR, '"log"');
    expectHarError(
      () => parseHar('{"log":{"version":"1.2"}}'),
      ERROR_CODES.NOT_A_HAR,
      'log.entries',
    );
    expectHarError(
      () => parseHar('{"log":{"entries":"nope"}}'),
      ERROR_CODES.NOT_A_HAR,
      'log.entries',
    );
  });
});

describe('summarizeEntry', () => {
  it('builds a list row from an entry', () => {
    const parsed = parseHar(
      harToBuffer(
        makeHar([
          makeEntry({
            method: 'POST',
            url: 'https://api.example.test/orders',
            requestBody: { mimeType: 'application/json', text: '{}' },
            responseBody: { mimeType: 'application/json; charset=utf-8', text: '[]', size: 2 },
          }),
        ]),
      ),
    );
    expect(summarizeEntry(parsed.entries[0]!)).toEqual({
      index: 0,
      startedDateTime: '2026-01-01T10:00:00.000Z',
      method: 'POST',
      url: 'https://api.example.test/orders',
      host: 'api.example.test',
      path: '/orders',
      status: 200,
      statusText: 'OK',
      resourceType: 'xhr',
      mimeType: 'application/json',
      time: 12.5,
      size: 2,
      hasRequestBody: true,
      hasResponseBody: true,
    });
  });
});
