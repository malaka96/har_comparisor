import type { EntryComparison } from './compare.js';
import type { EntrySummary } from './har.js';

export const REDACTED = '[redacted]';

/** Header names whose values are credentials. */
const SECRET_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
]);

/** Names that suggest a secret: used for headers, query parameters and body fields. */
const SECRET_NAME =
  /password|passwd|pwd|token|secret|api[-_]?key|authori[sz]ation|cookie|session|credential/i;

export function isSecretHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_HEADERS.has(lower) || SECRET_NAME.test(lower);
}

/** The last name in a JSON path such as `$.user["api-key"]` or `$.items[2].token`. */
function lastFieldName(path: string): string {
  const quoted = /\["((?:[^"\\]|\\.)*)"\]$/.exec(path);
  if (quoted) return quoted[1] as string;
  const dotted = /\.([A-Za-z_$][\w$]*)$/.exec(path);
  return dotted ? (dotted[1] as string) : '';
}

export function isSecretField(path: string): boolean {
  const name = lastFieldName(path);
  return name !== '' && SECRET_NAME.test(name);
}

export type ReportArea =
  | 'method'
  | 'status'
  | 'url'
  | 'query'
  | 'request header'
  | 'response header'
  | 'request body'
  | 'response body';

export interface ReportDifference {
  area: ReportArea;
  /** What differs: a header name, a query parameter, a JSON path, or empty for the whole part. */
  field: string;
  /** For example `changed`, `added`, `removed`, `value`, `type`, `order`. */
  kind: string;
  legacy?: string;
  new?: string;
  /** A plain explanation, for example when bodies could only be compared as text or binary. */
  note?: string;
}

export interface ReportRequest {
  index: number;
  method: string;
  /** Path and query, without the host. */
  url: string;
  status: number;
}

export interface ReportPair {
  /** Pair number shown in the app (`#n`). */
  number: number;
  legacy: ReportRequest;
  new: ReportRequest;
  verdict: 'identical' | 'different';
  headersDiffer: boolean;
  outOfOrder: boolean;
  /** Differences that decide the verdict, then header differences. */
  differences: ReportDifference[];
}

export interface ReportSummary {
  pairs: number;
  identical: number;
  different: number;
  headerDifferences: number;
  outOfOrder: number;
  missing: number;
  extra: number;
}

export interface Report {
  title: string;
  generatedAt: string;
  redacted: boolean;
  legacy: { fileName: string; requests: number };
  new: { fileName: string; requests: number };
  summary: ReportSummary;
  pairs: ReportPair[];
  /** Legacy requests that are not paired. */
  missing: ReportRequest[];
  /** New requests that are not paired. */
  extra: ReportRequest[];
}

export interface ReportPairInput {
  number: number;
  legacy: EntrySummary;
  new: EntrySummary;
  comparison: EntryComparison;
  outOfOrder: boolean;
}

export interface ReportInput {
  generatedAt: string;
  redact: boolean;
  legacy: { fileName: string; entries: EntrySummary[] };
  new: { fileName: string; entries: EntrySummary[] };
  pairs: ReportPairInput[];
}

function requestOf(entry: EntrySummary): ReportRequest {
  let url = entry.path;
  try {
    const parsed = new URL(entry.url);
    url = parsed.pathname + parsed.search;
  } catch {
    // keep the path when the URL cannot be read
  }
  return { index: entry.index, method: entry.method, url, status: entry.status };
}

function redactQueryString(url: string, redact: boolean): string {
  if (!redact) return url;
  const question = url.indexOf('?');
  if (question < 0) return url;
  const params = new URLSearchParams(url.slice(question + 1));
  let changed = false;
  for (const [name] of params) {
    if (SECRET_NAME.test(name)) {
      params.set(name, REDACTED);
      changed = true;
    }
  }
  return changed ? `${url.slice(0, question)}?${params.toString()}` : url;
}

/** Builds a difference, leaving out missing values and hiding secret ones. */
function difference(
  area: ReportArea,
  field: string,
  kind: string,
  legacy: string | undefined,
  next: string | undefined,
  secret: boolean,
): ReportDifference {
  const result: ReportDifference = { area, field, kind };
  if (legacy !== undefined) result.legacy = secret ? REDACTED : legacy;
  if (next !== undefined) result.new = secret ? REDACTED : next;
  return result;
}

function differencesOf(comparison: EntryComparison, redact: boolean): ReportDifference[] {
  const out: ReportDifference[] = [];
  const { method, status, url, details } = comparison;
  if (!method.identical) {
    out.push({
      area: 'method',
      field: '',
      kind: 'changed',
      legacy: method.legacy,
      new: method.new,
    });
  }
  if (!status.identical) {
    out.push({
      area: 'status',
      field: '',
      kind: 'changed',
      legacy: `${status.legacy} ${details.statusText.legacy}`.trim(),
      new: `${status.new} ${details.statusText.new}`.trim(),
    });
  }
  for (const part of ['scheme', 'host', 'path'] as const) {
    const value = url[part];
    if (!value.identical) {
      out.push({ area: 'url', field: part, kind: 'changed', legacy: value.legacy, new: value.new });
    }
  }
  for (const change of url.query.changes) {
    out.push(
      difference(
        'query',
        change.name,
        change.kind,
        change.legacy,
        change.new,
        redact && SECRET_NAME.test(change.name),
      ),
    );
  }
  for (const [area, body] of [
    ['request body', comparison.requestBody],
    ['response body', comparison.responseBody],
  ] as const) {
    if (body.identical) continue;
    if (body.changes.length === 0) {
      const difference: ReportDifference = {
        area,
        field: '',
        kind: body.kind === 'binary' ? 'binary' : 'changed',
      };
      if (body.note) difference.note = body.note;
      out.push(difference);
      continue;
    }
    for (const change of body.changes) {
      out.push(
        difference(
          area,
          change.path,
          change.kind,
          change.legacy,
          change.new,
          redact && isSecretField(change.path),
        ),
      );
    }
  }
  for (const [area, headers] of [
    ['request header', comparison.requestHeaders],
    ['response header', comparison.responseHeaders],
  ] as const) {
    for (const row of headers.rows) {
      if (row.kind === 'same' || row.ignored) continue;
      out.push(
        difference(
          area,
          row.name,
          row.kind,
          row.legacy,
          row.new,
          redact && isSecretHeader(row.name),
        ),
      );
    }
  }
  return out;
}

/** Builds the report for the pairs the user made. Pure: no I/O. */
export function buildReport(input: ReportInput): Report {
  const pairedLegacy = new Set(input.pairs.map((p) => p.legacy.index));
  const pairedNew = new Set(input.pairs.map((p) => p.new.index));
  const strip = (request: ReportRequest): ReportRequest => ({
    ...request,
    url: redactQueryString(request.url, input.redact),
  });

  const pairs: ReportPair[] = [...input.pairs]
    .sort((a, b) => a.number - b.number)
    .map((p) => ({
      number: p.number,
      legacy: strip(requestOf(p.legacy)),
      new: strip(requestOf(p.new)),
      verdict: p.comparison.identical ? 'identical' : 'different',
      headersDiffer: !p.comparison.headersIdentical,
      outOfOrder: p.outOfOrder,
      differences: differencesOf(p.comparison, input.redact),
    }));

  const missing = input.legacy.entries
    .filter((e) => !pairedLegacy.has(e.index))
    .map((e) => strip(requestOf(e)));
  const extra = input.new.entries
    .filter((e) => !pairedNew.has(e.index))
    .map((e) => strip(requestOf(e)));

  return {
    title: `HAR comparison: ${input.legacy.fileName} vs ${input.new.fileName}`,
    generatedAt: input.generatedAt,
    redacted: input.redact,
    legacy: { fileName: input.legacy.fileName, requests: input.legacy.entries.length },
    new: { fileName: input.new.fileName, requests: input.new.entries.length },
    summary: {
      pairs: pairs.length,
      identical: pairs.filter((p) => p.verdict === 'identical').length,
      different: pairs.filter((p) => p.verdict === 'different').length,
      headerDifferences: pairs.filter((p) => p.headersDiffer).length,
      outOfOrder: pairs.filter((p) => p.outOfOrder).length,
      missing: missing.length,
      extra: extra.length,
    },
    pairs,
    missing,
    extra,
  };
}
