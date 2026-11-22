/**
 * Synthetic HAR files for end-to-end tests. Everything here is made up.
 * Never add real HAR content to the repository.
 */
import { writeFileSync } from 'node:fs';

type Json = Record<string, unknown>;

interface EntrySpec {
  method?: string;
  path: string;
  query?: Record<string, string>;
  status?: number;
  statusText?: string;
  requestBody?: { mimeType: string; text: string };
  response?: { mimeType: string; text?: string; encoding?: 'base64'; size?: number };
  redirectUrl?: string;
  resourceType?: string;
}

const HOST = 'https://api.example.test';

export function entry(spec: EntrySpec): Json {
  const url = new URL(spec.path, HOST);
  for (const [name, value] of Object.entries(spec.query ?? {})) url.searchParams.set(name, value);
  const response = spec.response ?? { mimeType: 'application/json', text: '{}' };
  return {
    startedDateTime: '2026-01-01T10:00:00.000Z',
    time: 25,
    request: {
      method: spec.method ?? 'GET',
      url: url.toString(),
      httpVersion: 'HTTP/1.1',
      headers: [{ name: 'Accept', value: 'application/json' }],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
      ...(spec.requestBody ? { postData: spec.requestBody } : {}),
    },
    response: {
      status: spec.status ?? 200,
      statusText: spec.statusText ?? 'OK',
      httpVersion: 'HTTP/1.1',
      headers: [{ name: 'Content-Type', value: response.mimeType }],
      cookies: [],
      content: {
        mimeType: response.mimeType,
        size: response.size ?? response.text?.length ?? 0,
        ...(response.text !== undefined ? { text: response.text } : {}),
        ...(response.encoding ? { encoding: response.encoding } : {}),
      },
      redirectURL: spec.redirectUrl ?? '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { blocked: 1, dns: -1, connect: -1, ssl: -1, send: 1, wait: 20, receive: 3 },
    _resourceType: spec.resourceType ?? 'xhr',
  };
}

export function har(entries: Json[]): Json {
  return {
    log: {
      version: '1.2',
      creator: { name: 'Synthetic', version: '1.0' },
      pages: [{ id: 'page_1', title: 'Synthetic page' }],
      entries,
    },
  };
}

const json = (value: unknown) => ({ mimeType: 'application/json', text: JSON.stringify(value) });
const PNG = {
  mimeType: 'image/png',
  text: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
  encoding: 'base64' as const,
  size: 24,
};

/**
 * The legacy side of the main scenario. Indexes are referred to in the tests.
 *
 * | # | Request                    | Pairs with new # | Expected              |
 * | 0 | GET /api/users?page=1      | 0                | different (value)     |
 * | 1 | GET /api/config            | 1                | identical             |
 * | 2 | POST /api/orders (500)     | 3 (swapped)      | different (status...) |
 * | 3 | GET /api/search/hom        | 2 (swapped)      | different (path)      |
 * | 4 | GET /static/logo.png       | 4                | identical (Base64)    |
 * | 5 | DELETE /api/session (204)  | 5                | identical (no body)   |
 * | 6 | GET /api/notes (text)      | 6                | different (text)      |
 * | 7 | GET /api/legacy-only       | -                | missing in new        |
 */
export function legacyScenario(): Json {
  return har([
    entry({
      path: '/api/users',
      query: { page: '1' },
      response: json({ users: [{ id: 1, name: 'Ann' }] }),
    }),
    entry({ path: '/api/config', response: json({ theme: 'light', limits: { max: 10 } }) }),
    entry({
      method: 'POST',
      path: '/api/orders',
      status: 500,
      statusText: 'Internal Server Error',
      requestBody: json({ item: 'book', qty: 1 }),
      response: json({ error: 'boom' }),
    }),
    entry({ path: '/api/search/hom', response: json([]) }),
    entry({ path: '/static/logo.png', response: PNG, resourceType: 'image' }),
    entry({
      method: 'DELETE',
      path: '/api/session',
      status: 204,
      statusText: 'No Content',
      response: { mimeType: '', size: 0 },
    }),
    entry({
      path: '/api/notes',
      response: { mimeType: 'text/plain', text: 'line one\nline two\n' },
    }),
    entry({ path: '/api/legacy-only', response: json({ old: true }) }),
  ]);
}

/**
 * The new side of the main scenario.
 *
 * | # | Request                      | Notes                                  |
 * | 0 | GET /api/users?page=1        | name changed                           |
 * | 1 | GET /api/config              | same content, different key order      |
 * | 2 | GET /api/search/homa         | called before orders (swapped)         |
 * | 3 | POST /api/orders (200)       | qty sent as a string, new response     |
 * | 4 | GET /static/logo.png         | same Base64 body                       |
 * | 5 | DELETE /api/session (204)    | no body                                |
 * | 6 | GET /api/notes (text)        | second line changed                    |
 * | 7 | GET /api/new-only            | extra in new                           |
 * | 8 | GET /api/old-path (302)      | redirect, extra in new                 |
 * | 9 | GET /api/offline (failed)    | status 0, extra in new                 |
 */
export function newScenario(): Json {
  return har([
    entry({
      path: '/api/users',
      query: { page: '1' },
      response: json({ users: [{ id: 1, name: 'Bob' }] }),
    }),
    entry({ path: '/api/config', response: json({ limits: { max: 10 }, theme: 'light' }) }),
    entry({ path: '/api/search/homa', response: json([]) }),
    entry({
      method: 'POST',
      path: '/api/orders',
      requestBody: json({ item: 'book', qty: '1' }),
      response: json({ id: 42, status: 'NEW' }),
    }),
    entry({ path: '/static/logo.png', response: PNG, resourceType: 'image' }),
    entry({
      method: 'DELETE',
      path: '/api/session',
      status: 204,
      statusText: 'No Content',
      response: { mimeType: '', size: 0 },
    }),
    entry({ path: '/api/notes', response: { mimeType: 'text/plain', text: 'line one\nline 2\n' } }),
    entry({ path: '/api/new-only', response: json({ fresh: true }) }),
    entry({
      path: '/api/old-path',
      status: 302,
      statusText: 'Found',
      redirectUrl: `${HOST}/api/new-path`,
      response: { mimeType: '', size: 0 },
    }),
    entry({ path: '/api/offline', status: 0, statusText: '', response: { mimeType: '', size: 0 } }),
  ]);
}

/**
 * A large HAR: `count` JSON requests, each with a body of about `bodyBytes`.
 * Used to check that big files load, list and compare without freezing the page.
 */
export function largeHar(count: number, bodyBytes: number, variant: 'a' | 'b'): Json {
  const filler = 'x'.repeat(Math.max(0, bodyBytes - 200));
  const entries: Json[] = [];
  for (let i = 0; i < count; i++) {
    const body = {
      id: i,
      name: `item ${i}`,
      price: variant === 'b' && i % 500 === 0 ? i + 1 : i,
      filler,
    };
    entries.push(entry({ path: `/api/items/${i}`, response: json(body) }));
  }
  return har(entries);
}

/** Writes a HAR object to a file and returns the path. */
export function writeHar(path: string, content: unknown): string {
  writeFileSync(path, JSON.stringify(content));
  return path;
}
