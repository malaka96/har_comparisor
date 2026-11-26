import type { NameValue, NormalizedBody, NormalizedEntry } from './har.js';
import { diffJson, type JsonChange } from './json-diff.js';

export interface ValueComparison<T> {
  legacy: T;
  new: T;
  identical: boolean;
}

export interface QueryChange {
  name: string;
  kind: 'added' | 'removed' | 'changed';
  /** Values joined with ", " when a parameter is repeated. Absent for `added`. */
  legacy?: string;
  /** Absent for `removed`. */
  new?: string;
}

export interface UrlComparison {
  identical: boolean;
  scheme: ValueComparison<string>;
  host: ValueComparison<string>;
  path: ValueComparison<string>;
  query: {
    identical: boolean;
    changes: QueryChange[];
  };
}

export type BodyKind = 'none' | 'json' | 'text' | 'binary';

export interface BodyComparison {
  identical: boolean;
  /** How the bodies were compared. `json` only when both sides are valid JSON. */
  kind: BodyKind;
  legacyPresent: boolean;
  newPresent: boolean;
  /** Field-level changes, only when both sides are JSON. */
  changes: JsonChange[];
  truncated: boolean;
  /** A plain explanation when the comparison is not field-level. */
  note?: string;
}

export interface HeaderRow {
  /** Header name as recorded on the legacy side (or the new side when only there). */
  name: string;
  kind: 'same' | 'added' | 'removed' | 'changed';
  /** Values joined with ", " when the header is repeated. Absent for `added`. */
  legacy?: string;
  /** Absent for `removed`. */
  new?: string;
  /** True when the header is on the ignore list: shown, but not counted as a difference. */
  ignored: boolean;
  /** True when both sides have the header but spell its name with different letter case. */
  caseDiffers?: boolean;
}

export interface HeaderComparison {
  /** True when no header outside the ignore list differs. */
  identical: boolean;
  /** Number of differing headers outside the ignore list. */
  differences: number;
  /** Every header of both sides, sorted by name. */
  rows: HeaderRow[];
}

/** One path segment that differs, with its Base64-decoded text when it looks encoded. */
export interface PathSegmentChange {
  /** Position of the segment, 1 for the first segment after the leading slash. */
  position: number;
  legacy: string;
  new: string;
  legacyDecoded?: string;
  newDecoded?: string;
}

/**
 * Extra details shown with a comparison (F14). They help explain a difference, but they do not
 * decide whether a pair is identical: status, URL, headers and bodies already do that.
 */
export interface ComparisonDetails {
  statusText: ValueComparison<string>;
  /** `2xx`, `3xx`, `4xx`, `5xx`, or `failed` for status 0. */
  statusClass: ValueComparison<string>;
  /** Main response MIME type, for example `application/json`. */
  contentType: ValueComparison<string>;
  /** Redirect target recorded by the browser. Empty when there is none. */
  redirect: ValueComparison<string>;
  /** Response body size in bytes. -1 when unknown. */
  responseSize: ValueComparison<number>;
  /** Total time in milliseconds. -1 when unknown. */
  time: ValueComparison<number>;
  /** Differing path segments, only when both paths have the same number of segments. */
  pathSegments: PathSegmentChange[];
}

export interface EntryComparison {
  /**
   * True when method, status, URL, both bodies and the headers outside the ignore list are the same.
   */
  identical: boolean;
  method: ValueComparison<string>;
  status: ValueComparison<number>;
  url: UrlComparison;
  requestHeaders: HeaderComparison;
  responseHeaders: HeaderComparison;
  requestBody: BodyComparison;
  responseBody: BodyComparison;
  details: ComparisonDetails;
}

export function statusClassOf(status: number): string {
  return status <= 0 ? 'failed' : `${Math.floor(status / 100)}xx`;
}

const BASE64_SEGMENT = /^[A-Za-z0-9+/_-]{8,}={0,2}$/;
const PRINTABLE = /^[\x20-\x7e]+$/;

/**
 * Decodes a path segment that looks like Base64 text, for example `NzQ0MjQ5NTc0` (`744249574`).
 * Returns undefined when the segment is not Base64 or does not decode to printable text.
 */
export function decodeBase64Segment(segment: string): string | undefined {
  let raw: string;
  try {
    raw = decodeURIComponent(segment);
  } catch {
    raw = segment;
  }
  if (!BASE64_SEGMENT.test(raw)) return undefined;
  // Plain numbers and plain words of letters are far more likely ids or names than Base64.
  if (/^\d+$/.test(raw) || /^[a-z]+$/.test(raw) || /^[A-Z]+$/.test(raw)) return undefined;
  // Accept URL-safe Base64 and missing padding.
  const body = raw.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (body.length % 4 === 1) return undefined;
  let decoded: string;
  try {
    decoded = atob(body + '='.repeat((4 - (body.length % 4)) % 4));
  } catch {
    return undefined;
  }
  return PRINTABLE.test(decoded) && decoded !== raw ? decoded : undefined;
}

function comparePathSegments(legacyPath: string, newPath: string): PathSegmentChange[] {
  const a = legacyPath.split('/');
  const b = newPath.split('/');
  if (a.length !== b.length) return [];
  const changes: PathSegmentChange[] = [];
  for (let i = 1; i < a.length; i++) {
    const left = a[i] as string;
    const right = b[i] as string;
    if (left === right) continue;
    const change: PathSegmentChange = { position: i, legacy: left, new: right };
    const leftDecoded = decodeBase64Segment(left);
    const rightDecoded = decodeBase64Segment(right);
    if (leftDecoded !== undefined) change.legacyDecoded = leftDecoded;
    if (rightDecoded !== undefined) change.newDecoded = rightDecoded;
    changes.push(change);
  }
  return changes;
}

function mainMimeType(mimeType: string | undefined): string {
  return (mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function compareDetails(legacy: NormalizedEntry, next: NormalizedEntry): ComparisonDetails {
  return {
    statusText: compareValue(legacy.response.statusText, next.response.statusText),
    statusClass: compareValue(
      statusClassOf(legacy.response.status),
      statusClassOf(next.response.status),
    ),
    contentType: compareValue(
      mainMimeType(legacy.response.body?.mimeType),
      mainMimeType(next.response.body?.mimeType),
    ),
    redirect: compareValue(legacy.response.redirectUrl, next.response.redirectUrl),
    responseSize: compareValue(legacy.response.body?.size ?? -1, next.response.body?.size ?? -1),
    time: compareValue(legacy.time, next.time),
    pathSegments: comparePathSegments(legacy.request.path, next.request.path),
  };
}

/**
 * Headers that usually differ on every request, or repeat what is compared elsewhere.
 * They are still shown, but they do not make a pair "different".
 */
export const DEFAULT_IGNORED_HEADERS: readonly string[] = [
  // HTTP/2 pseudo-headers repeat the method and URL, which are compared on their own.
  ':authority',
  ':method',
  ':path',
  ':scheme',
  ':status',
  // Dates and caching validators change over time.
  'date',
  'age',
  'expires',
  'last-modified',
  'etag',
  'if-modified-since',
  'if-none-match',
  // Sizes follow the body, which is compared directly.
  'content-length',
  // Sessions and the page the request came from differ between runs and apps.
  'cookie',
  'set-cookie',
  'referer',
  // Tracing and infrastructure IDs.
  'x-request-id',
  'x-correlation-id',
  'request-id',
  'traceparent',
  'tracestate',
  'x-amzn-trace-id',
  'x-amz-cf-id',
  'x-amz-cf-pop',
  'cf-ray',
  'server-timing',
  'report-to',
  'nel',
];

const IGNORED = new Set(DEFAULT_IGNORED_HEADERS);

interface HeaderGroup {
  name: string;
  values: string[];
}

function groupHeaders(headers: NameValue[]): Map<string, HeaderGroup> {
  const groups = new Map<string, HeaderGroup>();
  for (const { name, value } of headers) {
    const key = name.toLowerCase();
    const group = groups.get(key);
    if (group) group.values.push(value);
    else groups.set(key, { name, values: [value] });
  }
  return groups;
}

export function compareHeaders(legacy: NameValue[], next: NameValue[]): HeaderComparison {
  const a = groupHeaders(legacy);
  const b = groupHeaders(next);
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  const rows: HeaderRow[] = [];
  let differences = 0;
  for (const key of keys) {
    const left = a.get(key);
    const right = b.get(key);
    const ignored = IGNORED.has(key);
    let row: HeaderRow;
    if (left && right) {
      const same = left.values.join('\u0000') === right.values.join('\u0000');
      row = {
        name: left.name,
        kind: same ? 'same' : 'changed',
        legacy: left.values.join(', '),
        new: right.values.join(', '),
        ignored,
      };
      if (left.name !== right.name) row.caseDiffers = true;
    } else if (left) {
      row = { name: left.name, kind: 'removed', legacy: left.values.join(', '), ignored };
    } else {
      const only = right as HeaderGroup;
      row = { name: only.name, kind: 'added', new: only.values.join(', '), ignored };
    }
    if (row.kind !== 'same' && !ignored) differences++;
    rows.push(row);
  }
  return { identical: differences === 0, differences, rows };
}

function compareValue<T>(legacy: T, next: T): ValueComparison<T> {
  return { legacy, new: next, identical: legacy === next };
}

function groupQuery(params: NameValue[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const { name, value } of params) {
    const values = groups.get(name);
    if (values) values.push(value);
    else groups.set(name, [value]);
  }
  return groups;
}

export function compareQuery(legacy: NameValue[], next: NameValue[]): QueryChange[] {
  const a = groupQuery(legacy);
  const b = groupQuery(next);
  const changes: QueryChange[] = [];
  for (const [name, values] of a) {
    const other = b.get(name);
    if (!other) changes.push({ name, kind: 'removed', legacy: values.join(', ') });
    else if (values.join('\u0000') !== other.join('\u0000')) {
      changes.push({ name, kind: 'changed', legacy: values.join(', '), new: other.join(', ') });
    }
  }
  for (const [name, values] of b) {
    if (!a.has(name)) changes.push({ name, kind: 'added', new: values.join(', ') });
  }
  return changes;
}

function compareUrl(legacy: NormalizedEntry, next: NormalizedEntry): UrlComparison {
  const scheme = compareValue(legacy.request.scheme, next.request.scheme);
  const host = compareValue(legacy.request.host, next.request.host);
  const path = compareValue(legacy.request.path, next.request.path);
  const changes = compareQuery(legacy.request.query, next.request.query);
  const query = { identical: changes.length === 0, changes };
  return {
    identical: scheme.identical && host.identical && path.identical && query.identical,
    scheme,
    host,
    path,
    query,
  };
}

/** Text of a body as recorded, or the form parameters when no text was recorded. */
function bodyText(body: NormalizedBody | undefined): string | undefined {
  if (!body) return undefined;
  if (body.text !== undefined) return body.text;
  if (body.params && body.params.length > 0) {
    return body.params.map((p) => `${p.name}=${p.value}`).join('&');
  }
  return undefined;
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false };
  }
}

export function compareBodies(
  legacy: NormalizedBody | undefined,
  next: NormalizedBody | undefined,
): BodyComparison {
  const legacyText = bodyText(legacy);
  const nextText = bodyText(next);
  const legacyPresent = legacyText !== undefined && legacyText !== '';
  const newPresent = nextText !== undefined && nextText !== '';
  const base = { legacyPresent, newPresent, changes: [], truncated: false };

  if (!legacyPresent && !newPresent) {
    const unrecorded =
      (legacy?.size ?? 0) > 0 || (next?.size ?? 0) > 0
        ? 'The browser did not record the body text, so it cannot be compared.'
        : undefined;
    return { ...base, identical: true, kind: 'none', ...(unrecorded ? { note: unrecorded } : {}) };
  }
  if (!legacyPresent || !newPresent) {
    return {
      ...base,
      identical: false,
      kind: 'none',
      note: legacyPresent
        ? 'Only the legacy request has a body.'
        : 'Only the new request has a body.',
    };
  }

  const a = legacyText as string;
  const b = nextText as string;

  if (legacy?.encoding === 'base64' || next?.encoding === 'base64') {
    const identical = a === b && legacy?.encoding === next?.encoding;
    return {
      ...base,
      identical,
      kind: 'binary',
      note: identical
        ? 'Binary content is the same.'
        : `Binary content differs (${legacy?.size ?? a.length} vs ${next?.size ?? b.length} bytes).`,
    };
  }

  const parsedA = tryParseJson(a);
  const parsedB = tryParseJson(b);
  if (parsedA.ok && parsedB.ok) {
    const diff = diffJson(parsedA.value, parsedB.value);
    return {
      ...base,
      identical: diff.changes.length === 0,
      kind: 'json',
      changes: diff.changes,
      truncated: diff.truncated,
    };
  }

  const identical = a === b;
  const note =
    parsedA.ok !== parsedB.ok
      ? 'Only one side is valid JSON, so the bodies were compared as text.'
      : undefined;
  return { ...base, identical, kind: 'text', ...(note ? { note } : {}) };
}

/** Compares a legacy entry with the new entry the user paired it with. */
export function compareEntries(legacy: NormalizedEntry, next: NormalizedEntry): EntryComparison {
  const method = compareValue(legacy.request.method, next.request.method);
  const status = compareValue(legacy.response.status, next.response.status);
  const url = compareUrl(legacy, next);
  const requestHeaders = compareHeaders(legacy.request.headers, next.request.headers);
  const responseHeaders = compareHeaders(legacy.response.headers, next.response.headers);
  const requestBody = compareBodies(legacy.request.body, next.request.body);
  const responseBody = compareBodies(legacy.response.body, next.response.body);
  return {
    identical:
      method.identical &&
      status.identical &&
      url.identical &&
      requestHeaders.identical &&
      responseHeaders.identical &&
      requestBody.identical &&
      responseBody.identical,
    method,
    status,
    url,
    requestHeaders,
    responseHeaders,
    requestBody,
    responseBody,
    details: compareDetails(legacy, next),
  };
}

/** Response of the compare endpoint. */
export interface CompareResponse {
  legacy: NormalizedEntry;
  new: NormalizedEntry;
  comparison: EntryComparison;
}

/** Response of the compare endpoint with `entries=false`. */
export interface CompareSummaryResponse {
  comparison: EntryComparison;
}
