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

export interface EntryComparison {
  /** True when method, status, URL and both bodies are the same. Headers are not compared yet. */
  identical: boolean;
  method: ValueComparison<string>;
  status: ValueComparison<number>;
  url: UrlComparison;
  requestBody: BodyComparison;
  responseBody: BodyComparison;
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
  const requestBody = compareBodies(legacy.request.body, next.request.body);
  const responseBody = compareBodies(legacy.response.body, next.response.body);
  return {
    identical:
      method.identical &&
      status.identical &&
      url.identical &&
      requestBody.identical &&
      responseBody.identical,
    method,
    status,
    url,
    requestBody,
    responseBody,
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
