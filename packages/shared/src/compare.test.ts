import { describe, expect, it } from 'vitest';
import { compareBodies, compareEntries, compareQuery } from './compare.js';
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

  it('compares form parameters when no text was recorded', () => {
    const form = (value: string): NormalizedBody => ({
      mimeType: 'application/x-www-form-urlencoded',
      params: [{ name: 'a', value }],
    });
    expect(compareBodies(form('1'), form('1')).identical).toBe(true);
    expect(compareBodies(form('1'), form('2')).identical).toBe(false);
  });
});
