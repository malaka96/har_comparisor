/**
 * Builders for small synthetic HAR files used in tests.
 * Never put real HAR content in tests.
 */

type Json = Record<string, unknown>;

export interface EntryOptions {
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Array<{ name: string; value: string }>;
  responseHeaders?: Array<{ name: string; value: string }>;
  requestBody?: {
    mimeType: string;
    text?: string;
    params?: Array<{ name: string; value: string }>;
  };
  responseBody?: { mimeType: string; text?: string; encoding?: string; size?: number };
  resourceType?: string;
  /** Extra fields to merge into the entry, for example to add `_initiator`. */
  extra?: Json;
}

export function makeEntry(options: EntryOptions = {}): Json {
  const entry: Json = {
    startedDateTime: '2026-01-01T10:00:00.000Z',
    time: 12.5,
    request: {
      method: options.method ?? 'GET',
      url: options.url ?? 'https://api.example.test/items?page=1&sort=name',
      httpVersion: 'HTTP/1.1',
      headers: options.requestHeaders ?? [{ name: 'Accept', value: 'application/json' }],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
      ...(options.requestBody
        ? {
            postData: {
              mimeType: options.requestBody.mimeType,
              ...(options.requestBody.text !== undefined ? { text: options.requestBody.text } : {}),
              ...(options.requestBody.params ? { params: options.requestBody.params } : {}),
            },
          }
        : {}),
    },
    response: {
      status: options.status ?? 200,
      statusText: options.statusText ?? 'OK',
      httpVersion: 'HTTP/1.1',
      headers: options.responseHeaders ?? [{ name: 'Content-Type', value: 'application/json' }],
      cookies: [],
      content: options.responseBody ?? {
        mimeType: 'application/json',
        text: '{"ok":true}',
        size: 11,
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { blocked: 1, dns: -1, connect: -1, ssl: -1, send: 0.5, wait: 10, receive: 1 },
    _resourceType: options.resourceType ?? 'xhr',
    ...options.extra,
  };
  return entry;
}

export function makeHar(entries: Json[] = [makeEntry()], logOverrides: Json = {}): Json {
  return {
    log: {
      version: '1.2',
      creator: { name: 'WebInspector', version: '537.36' },
      pages: [{ id: 'page_1', title: 'Test page' }],
      entries,
      ...logOverrides,
    },
  };
}

export function harToBuffer(har: unknown): Buffer {
  return Buffer.from(JSON.stringify(har), 'utf8');
}
