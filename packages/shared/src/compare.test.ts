import { describe, expect, it } from 'vitest';
import {
  compareBodies,
  compareEntries,
  compareHeaders,
  compareQuery,
  decodeBase64Segment,
} from './compare.js';
import type { NormalizedBody, NormalizedEntry } from './har.js';

function entry(overrides: {
  method?: string;
  url?: string;
  status?: number;
  requestBody?: NormalizedBody;
  responseBody?: NormalizedBody;
}): NormalizedEntry {
  const url = new URL(overrides.url ?? 'https://api.example.test/items?page=1');
  const result: NormalizedEntry = {
    index: 0,
    startedDateTime: '2026-01-01T00:00:00.000Z',
    time: 10,
    request: {
      method: overrides.method ?? 'GET',
      url: url.toString(),
      scheme: url.protocol.replace(':', ''),
      host: url.host,
      path: url.pathname,
      query: [...url.searchParams].map(([name, value]) => ({ name, value })),
      httpVersion: 'HTTP/1.1',
      headers: [],
    },
    response: {
      status: overrides.status ?? 200,
      statusText: '',
      httpVersion: '',
      headers: [],
      redirectUrl: '',
    },
    timings: {},
  };
  if (overrides.requestBody) result.request.body = overrides.requestBody;
  if (overrides.responseBody) result.response.body = overrides.responseBody;
  return result;
}

const json = (text: string): NormalizedBody => ({ mimeType: 'application/json', text });

describe('compareEntries', () => {
  it('marks identical requests as identical', () => {
    const a = entry({ responseBody: json('{"a":1}') });
    const b = entry({ responseBody: json('{ "a": 1 }') });
    const result = compareEntries(a, b);
    expect(result.identical).toBe(true);
    expect(result.responseBody.kind).toBe('json');
  });

  it('reports a status difference', () => {
    const result = compareEntries(entry({ status: 500 }), entry({ status: 200 }));
    expect(result.identical).toBe(false);
    expect(result.status).toEqual({ legacy: 500, new: 200, identical: false });
  });

  it('reports method, host and path differences', () => {
    const result = compareEntries(
      entry({ method: 'GET', url: 'https://a.test/x/hom' }),
      entry({ method: 'POST', url: 'https://b.test/x/homa' }),
    );
    expect(result.method.identical).toBe(false);
    expect(result.url.host).toEqual({ legacy: 'a.test', new: 'b.test', identical: false });
    expect(result.url.path).toEqual({ legacy: '/x/hom', new: '/x/homa', identical: false });
    expect(result.url.identical).toBe(false);
  });

  it('compares a failed request (status 0) with a successful one', () => {
    const result = compareEntries(entry({ status: 0 }), entry({ status: 200 }));
    expect(result.identical).toBe(false);
    expect(result.status).toEqual({ legacy: 0, new: 200, identical: false });
  });

  it('reports a scheme difference', () => {
    const result = compareEntries(
      entry({ url: 'http://a.test/x' }),
      entry({ url: 'https://a.test/x' }),
    );
    expect(result.url.scheme.identical).toBe(false);
    expect(result.identical).toBe(false);
  });

  it('reports field changes in the response body', () => {
    const result = compareEntries(
      entry({ responseBody: json('{"name":"a","count":1}') }),
      entry({ responseBody: json('{"name":"b","count":1}') }),
    );
    expect(result.identical).toBe(false);
    expect(result.responseBody.changes).toEqual([
      { path: '$.name', kind: 'value', legacy: '"a"', new: '"b"' },
    ]);
  });
});

describe('compareHeaders', () => {
  const h = (name: string, value: string) => ({ name, value });

  it('matches names without regard to letter case and notes the case difference', () => {
    const result = compareHeaders(
      [h('Content-Type', 'application/json')],
      [h('content-type', 'application/json')],
    );
    expect(result.identical).toBe(true);
    expect(result.rows).toEqual([
      {
        name: 'Content-Type',
        kind: 'same',
        legacy: 'application/json',
        new: 'application/json',
        ignored: false,
        caseDiffers: true,
      },
    ]);
  });

  it('finds added, removed and changed headers, sorted by name', () => {
    const result = compareHeaders(
      [h('Accept', 'application/json'), h('X-Old', '1'), h('Cache-Control', 'no-cache')],
      [h('Accept', 'text/html'), h('X-New', '2'), h('Cache-Control', 'no-cache')],
    );
    expect(result.differences).toBe(3);
    expect(result.identical).toBe(false);
    expect(result.rows.map((r) => [r.name, r.kind])).toEqual([
      ['Accept', 'changed'],
      ['Cache-Control', 'same'],
      ['X-New', 'added'],
      ['X-Old', 'removed'],
    ]);
  });

  it('shows ignored headers but does not count them', () => {
    const result = compareHeaders(
      [h('Date', 'Mon, 01 Jan 2026 10:00:00 GMT'), h('x-request-id', 'a'), h(':path', '/x')],
      [h('date', 'Tue, 02 Jan 2026 10:00:00 GMT'), h('X-Request-ID', 'b')],
    );
    expect(result.identical).toBe(true);
    expect(result.differences).toBe(0);
    expect(result.rows.every((r) => r.ignored)).toBe(true);
    expect(result.rows.find((r) => r.name === 'Date')?.kind).toBe('changed');
  });

  it('compares repeated headers as a list', () => {
    const result = compareHeaders(
      [h('Vary', 'Origin'), h('Vary', 'Accept')],
      [h('Vary', 'Origin')],
    );
    expect(result.rows[0]).toMatchObject({
      kind: 'changed',
      legacy: 'Origin, Accept',
      new: 'Origin',
    });
  });

  it('makes the pair different when a header outside the ignore list differs', () => {
    const a = entry({});
    const b = entry({});
    a.response.headers = [h('Content-Type', 'application/json')];
    b.response.headers = [h('Content-Type', 'text/plain')];
    const result = compareEntries(a, b);
    expect(result.responseHeaders.differences).toBe(1);
    expect(result.identical).toBe(false);
  });
});

describe('decodeBase64Segment', () => {
  it('decodes Base64 path segments to printable text (A11)', () => {
    expect(decodeBase64Segment('NzQ0MjQ5NTc0')).toBe('744249574');
    expect(decodeBase64Segment('dW5kZWZpbmVk')).toBe('undefined');
    expect(decodeBase64Segment('aGVsbG8gd29ybGQ')).toBe('hello world'); // no padding
  });

  it('leaves ordinary segments alone', () => {
    for (const segment of [
      'items',
      'orders',
      'ownership-transfer',
      '744249574',
      'GSM_SER_1001',
      'abc',
      'ABCDEFGHIJ',
    ]) {
      expect(decodeBase64Segment(segment)).toBeUndefined();
    }
  });
});

describe('comparison details (F14)', () => {
  it('reports status class, content type, size, time and redirect', () => {
    const a = entry({
      status: 500,
      responseBody: { mimeType: 'application/json; charset=utf-8', text: '{}', size: 2 },
    });
    const b = entry({ status: 302, responseBody: { mimeType: 'text/html', text: '<p>', size: 3 } });
    b.response.redirectUrl = 'https://api.example.test/next';
    b.time = 99;
    const { details } = compareEntries(a, b);
    expect(details.statusClass).toEqual({ legacy: '5xx', new: '3xx', identical: false });
    expect(details.contentType).toEqual({
      legacy: 'application/json',
      new: 'text/html',
      identical: false,
    });
    expect(details.responseSize).toEqual({ legacy: 2, new: 3, identical: false });
    expect(details.redirect).toEqual({
      legacy: '',
      new: 'https://api.example.test/next',
      identical: false,
    });
    expect(details.time).toEqual({ legacy: 10, new: 99, identical: false });
  });

  it('calls status 0 a failed request', () => {
    expect(
      compareEntries(entry({ status: 0 }), entry({ status: 0 })).details.statusClass.legacy,
    ).toBe('failed');
  });

  it('lists differing path segments with decoded values', () => {
    const { details } = compareEntries(
      entry({ url: 'https://a.test/customers/profile/NzQ0MjQ5NTc0' }),
      entry({ url: 'https://a.test/customers/profile/ODg4' }),
    );
    expect(details.pathSegments).toEqual([
      { position: 3, legacy: 'NzQ0MjQ5NTc0', new: 'ODg4', legacyDecoded: '744249574' },
    ]);
  });

  it('skips segment details when the paths have a different number of segments', () => {
    const { details } = compareEntries(
      entry({ url: 'https://a.test/a/b' }),
      entry({ url: 'https://a.test/a/b/c' }),
    );
    expect(details.pathSegments).toEqual([]);
  });

  it('does not change the verdict', () => {
    const a = entry({});
    const b = entry({});
    b.time = 500;
    expect(compareEntries(a, b).identical).toBe(true);
  });
});

describe('compareQuery', () => {
  it('finds added, removed and changed parameters, ignoring order', () => {
    const changes = compareQuery(
      [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
        { name: 'c', value: '3' },
      ],
      [
        { name: 'c', value: '3' },
        { name: 'a', value: '9' },
        { name: 'd', value: '4' },
      ],
    );
    expect(changes).toEqual([
      { name: 'a', kind: 'changed', legacy: '1', new: '9' },
      { name: 'b', kind: 'removed', legacy: '2' },
      { name: 'd', kind: 'added', new: '4' },
    ]);
  });

  it('compares repeated parameters as a list', () => {
    const changes = compareQuery(
      [
        { name: 'id', value: '1' },
        { name: 'id', value: '2' },
      ],
      [{ name: 'id', value: '1' }],
    );
    expect(changes).toEqual([{ name: 'id', kind: 'changed', legacy: '1, 2', new: '1' }]);
  });
});

describe('compareBodies', () => {
  it('treats two missing bodies as identical', () => {
    expect(compareBodies(undefined, undefined)).toMatchObject({ identical: true, kind: 'none' });
  });

  it('treats an empty body like a missing one (for example status 204)', () => {
    expect(compareBodies({ mimeType: 'text/plain', text: '' }, undefined)).toMatchObject({
      identical: true,
      kind: 'none',
    });
  });

  it('reports a body on one side only', () => {
    const result = compareBodies(undefined, json('{}'));
    expect(result).toMatchObject({ identical: false, legacyPresent: false, newPresent: true });
    expect(result.note).toContain('Only the new');
  });

  it('notes bodies whose text was not recorded', () => {
    const result = compareBodies({ mimeType: 'application/json', size: 10 }, undefined);
    expect(result.identical).toBe(true);
    expect(result.note).toContain('did not record');
  });

  it('compares text bodies as text', () => {
    const t = (text: string): NormalizedBody => ({ mimeType: 'text/plain', text });
    expect(compareBodies(t('hello'), t('hello'))).toMatchObject({ identical: true, kind: 'text' });
    expect(compareBodies(t('hello'), t('world'))).toMatchObject({ identical: false, kind: 'text' });
  });

  it('falls back to text when only one side is JSON', () => {
    const result = compareBodies(json('{"a":1}'), { mimeType: 'text/plain', text: 'oops' });
    expect(result).toMatchObject({ identical: false, kind: 'text' });
    expect(result.note).toContain('Only one side is valid JSON');
  });

  it('compares Base64 bodies without decoding them', () => {
    const b = (text: string): NormalizedBody => ({
      mimeType: 'image/png',
      text,
      encoding: 'base64',
    });
    expect(compareBodies(b('AAAA'), b('AAAA'))).toMatchObject({ identical: true, kind: 'binary' });
    expect(compareBodies(b('AAAA'), b('BBBB'))).toMatchObject({ identical: false, kind: 'binary' });
  });

  it('compares XML bodies as text', () => {
    const x = (text: string): NormalizedBody => ({ mimeType: 'application/xml', text });
    expect(compareBodies(x('<a>1</a>'), x('<a>1</a>'))).toMatchObject({
      identical: true,
      kind: 'text',
    });
    expect(compareBodies(x('<a>1</a>'), x('<a>2</a>'))).toMatchObject({
      identical: false,
      kind: 'text',
    });
  });

  it('treats JSON with surrounding whitespace as JSON', () => {
    expect(compareBodies(json('  {"a":1}\n'), json('{"a":1}'))).toMatchObject({
      identical: true,
      kind: 'json',
    });
  });

  it('compares form parameters when no text was recorded', () => {
    const form = (value: string): NormalizedBody => ({
      mimeType: 'application/x-www-form-urlencoded',
      params: [{ name: 'a', value }],
    });
    expect(compareBodies(form('1'), form('1')).identical).toBe(true);
    expect(compareBodies(form('1'), form('2')).identical).toBe(false);
  });
});
