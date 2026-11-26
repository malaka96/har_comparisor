import { describe, expect, it } from 'vitest';
import { compareEntries } from './compare.js';
import type { EntrySummary, NormalizedEntry } from './har.js';
import {
  REDACTED,
  buildReport,
  isSecretField,
  isSecretHeader,
  type ReportInput,
} from './report.js';

function normalized(
  index: number,
  overrides: {
    url?: string;
    status?: number;
    method?: string;
    requestHeaders?: Array<{ name: string; value: string }>;
    responseText?: string;
    requestText?: string;
  },
): NormalizedEntry {
  const url = new URL(overrides.url ?? 'https://api.example.test/items');
  return {
    index,
    startedDateTime: '',
    time: 5,
    request: {
      method: overrides.method ?? 'GET',
      url: url.toString(),
      scheme: 'https',
      host: url.host,
      path: url.pathname,
      query: [...url.searchParams].map(([name, value]) => ({ name, value })),
      httpVersion: '',
      headers: overrides.requestHeaders ?? [],
      ...(overrides.requestText !== undefined
        ? { body: { mimeType: 'application/json', text: overrides.requestText } }
        : {}),
    },
    response: {
      status: overrides.status ?? 200,
      statusText: 'OK',
      httpVersion: '',
      headers: [],
      redirectUrl: '',
      ...(overrides.responseText !== undefined
        ? { body: { mimeType: 'application/json', text: overrides.responseText } }
        : {}),
    },
    timings: {},
  };
}

function summaryOf(entry: NormalizedEntry): EntrySummary {
  return {
    index: entry.index,
    startedDateTime: '',
    method: entry.request.method,
    url: entry.request.url,
    host: entry.request.host,
    path: entry.request.path,
    status: entry.response.status,
    statusText: entry.response.statusText,
    mimeType: 'application/json',
    time: entry.time,
    hasRequestBody: entry.request.body !== undefined,
    hasResponseBody: entry.response.body !== undefined,
  };
}

function input(redact: boolean): ReportInput {
  const l0 = normalized(0, { responseText: '{"name":"Ann","token":"abc"}' });
  const n0 = normalized(0, { responseText: '{"name":"Bob","token":"xyz"}' });
  const l1 = normalized(1, {
    url: 'https://api.example.test/login?session=s1&page=1',
    method: 'POST',
    status: 500,
    requestHeaders: [{ name: 'Authorization', value: 'Bearer legacy' }],
    requestText: '{"user":"a","password":"one"}',
  });
  const n1 = normalized(2, {
    url: 'https://api.example.test/login?session=s2&page=1',
    method: 'POST',
    requestHeaders: [{ name: 'Authorization', value: 'Bearer new' }],
    requestText: '{"user":"a","password":"two"}',
  });
  const l2 = normalized(2, { url: 'https://api.example.test/legacy-only?api_key=k1' });
  const n2 = normalized(1, { url: 'https://api.example.test/new-only' });
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    redact,
    legacy: { fileName: 'legacy.har', entries: [l0, l1, l2].map(summaryOf) },
    new: { fileName: 'new.har', entries: [n0, n2, n1].map(summaryOf) },
    pairs: [
      {
        number: 2,
        legacy: summaryOf(l1),
        new: summaryOf(n1),
        comparison: compareEntries(l1, n1),
        outOfOrder: true,
      },
      {
        number: 1,
        legacy: summaryOf(l0),
        new: summaryOf(n0),
        comparison: compareEntries(l0, n0),
        outOfOrder: false,
      },
    ],
  };
}

describe('buildReport', () => {
  it('summarizes pairs, missing and extra requests', () => {
    const report = buildReport(input(false));
    expect(report.title).toBe('HAR comparison: legacy.har vs new.har');
    expect(report.summary).toEqual({
      pairs: 2,
      identical: 0,
      different: 2,
      headerDifferences: 1,
      outOfOrder: 1,
      missing: 1,
      extra: 1,
    });
    expect(report.pairs.map((p) => p.number)).toEqual([1, 2]);
    expect(report.missing).toEqual([
      { index: 2, method: 'GET', url: '/legacy-only?api_key=k1', status: 200 },
    ]);
    expect(report.extra.map((r) => r.url)).toEqual(['/new-only']);
  });

  it('lists the differences of each pair', () => {
    const report = buildReport(input(false));
    const login = report.pairs[1]!;
    expect(login.outOfOrder).toBe(true);
    expect(login.differences).toEqual(
      expect.arrayContaining([
        { area: 'status', field: '', kind: 'changed', legacy: '500 OK', new: '200 OK' },
        { area: 'query', field: 'session', kind: 'changed', legacy: 's1', new: 's2' },
        { area: 'request body', field: '$.password', kind: 'value', legacy: '"one"', new: '"two"' },
        {
          area: 'request header',
          field: 'Authorization',
          kind: 'changed',
          legacy: 'Bearer legacy',
          new: 'Bearer new',
        },
      ]),
    );
    expect(report.pairs[0]!.differences).toEqual([
      { area: 'response body', field: '$.name', kind: 'value', legacy: '"Ann"', new: '"Bob"' },
      { area: 'response body', field: '$.token', kind: 'value', legacy: '"abc"', new: '"xyz"' },
    ]);
  });

  it('hides secrets when redaction is on, in every place they can appear', () => {
    const report = buildReport(input(true));
    const text = JSON.stringify(report);
    for (const secret of [
      'Bearer legacy',
      'Bearer new',
      'one',
      'two',
      'abc',
      'xyz',
      's1',
      's2',
      'k1',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(report.redacted).toBe(true);
    expect(text).toContain(REDACTED);
    // Values that are not secrets stay readable.
    expect(report.pairs[0]!.differences[0]!.legacy).toBe('"Ann"');
    expect(report.pairs[1]!.legacy.url).toContain('page=1');
  });
});

describe('secret detection', () => {
  it('recognizes credential headers', () => {
    for (const name of [
      'Authorization',
      'Cookie',
      'set-cookie',
      'X-API-Key',
      'X-Auth-Token',
      'X-Session-Id',
    ]) {
      expect(isSecretHeader(name)).toBe(true);
    }
    for (const name of ['Content-Type', 'Accept', 'ngsw-bypass', 'Cache-Control']) {
      expect(isSecretHeader(name)).toBe(false);
    }
  });

  it('recognizes secret body fields by their last name', () => {
    expect(isSecretField('$.user.password')).toBe(true);
    expect(isSecretField('$.items[0].accessToken')).toBe(true);
    expect(isSecretField('$["api-key"]')).toBe(true);
    expect(isSecretField('$.passport')).toBe(false);
    expect(isSecretField('$.name')).toBe(false);
    expect(isSecretField('$[0]')).toBe(false);
  });
});
