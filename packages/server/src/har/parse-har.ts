import {
  ERROR_CODES,
  type HarWarning,
  type NameValue,
  type NormalizedBody,
  type NormalizedEntry,
  type NormalizedRequest,
  type NormalizedResponse,
  type NormalizedTimings,
} from '@har-comparisor/shared';
import { HarError } from './har-error.js';

export interface ParsedHar {
  harVersion: string;
  creator?: string;
  pageCount: number;
  /** Number of entries in the file, including skipped ones. */
  entryCount: number;
  entries: NormalizedEntry[];
  warnings: HarWarning[];
}

type Json = Record<string, unknown>;

const TIMING_KEYS = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'] as const;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toNameValues(value: unknown): NameValue[] {
  if (!Array.isArray(value)) return [];
  const result: NameValue[] = [];
  for (const item of value) {
    if (isObject(item) && typeof item['name'] === 'string') {
      result.push({ name: item['name'], value: asString(item['value']) });
    }
  }
  return result;
}

function toNormalizedBody(
  mimeType: unknown,
  text: unknown,
  encoding: unknown,
  size: unknown,
  params?: unknown,
): NormalizedBody | undefined {
  const body: NormalizedBody = { mimeType: asString(mimeType) };
  let hasContent = false;

  if (typeof text === 'string') {
    body.text = text;
    hasContent = true;
    if (encoding === 'base64') body.encoding = 'base64';
  }
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    body.size = size;
    if (size > 0) hasContent = true;
  }
  const formParams = toNameValues(params);
  if (formParams.length > 0) {
    body.params = formParams;
    hasContent = true;
  }
  return hasContent ? body : undefined;
}

function normalizeRequest(raw: unknown): NormalizedRequest {
  if (!isObject(raw)) throw new Error('"request" is missing');
  const rawUrl = raw['url'];
  if (typeof rawUrl !== 'string' || rawUrl === '') throw new Error('request has no URL');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('request URL cannot be read');
  }

  const query: NameValue[] = [];
  for (const [name, value] of url.searchParams) query.push({ name, value });

  const postData = isObject(raw['postData']) ? raw['postData'] : undefined;
  const request: NormalizedRequest = {
    method: asString(raw['method'], 'GET').toUpperCase(),
    url: rawUrl,
    scheme: url.protocol.replace(/:$/, ''),
    host: url.host,
    path: url.pathname,
    query,
    httpVersion: asString(raw['httpVersion']),
    headers: toNameValues(raw['headers']),
  };
  if (postData) {
    const body = toNormalizedBody(
      postData['mimeType'],
      postData['text'],
      undefined,
      undefined,
      postData['params'],
    );
    if (body) request.body = body;
  }
  return request;
}

function normalizeResponse(raw: unknown, warn: (message: string) => void): NormalizedResponse {
  if (!isObject(raw)) {
    warn('no response was recorded, treated as status 0');
    return { status: 0, statusText: '', httpVersion: '', headers: [], redirectUrl: '' };
  }
  const content = isObject(raw['content']) ? raw['content'] : undefined;
  const response: NormalizedResponse = {
    status: asNumber(raw['status'], 0),
    statusText: asString(raw['statusText']),
    httpVersion: asString(raw['httpVersion']),
    headers: toNameValues(raw['headers']),
    redirectUrl: asString(raw['redirectURL']),
  };
  if (content) {
    const body = toNormalizedBody(
      content['mimeType'],
      content['text'],
      content['encoding'],
      content['size'],
    );
    if (body) response.body = body;
  }
  return response;
}

function normalizeTimings(raw: unknown): NormalizedTimings {
  const timings: NormalizedTimings = {};
  if (!isObject(raw)) return timings;
  for (const key of TIMING_KEYS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) timings[key] = value;
  }
  return timings;
}

function normalizeEntry(
  raw: unknown,
  index: number,
  warn: (message: string) => void,
): NormalizedEntry {
  if (!isObject(raw)) throw new Error('entry is not an object');
  const request = normalizeRequest(raw['request']);
  const response = normalizeResponse(raw['response'], warn);
  const entry: NormalizedEntry = {
    index,
    startedDateTime: asString(raw['startedDateTime']),
    time: asNumber(raw['time'], -1),
    request,
    response,
    timings: normalizeTimings(raw['timings']),
  };
  const resourceType = raw['_resourceType'];
  if (typeof resourceType === 'string' && resourceType !== '') entry.resourceType = resourceType;
  const serverIp = raw['serverIPAddress'];
  if (typeof serverIp === 'string' && serverIp !== '') entry.serverIpAddress = serverIp;
  return entry;
}

function shorten(message: string, max = 200): string {
  return message.length > max ? `${message.slice(0, max)}...` : message;
}

/**
 * Reads a HAR file and returns normalized entries.
 * Throws a HarError when the file is empty, is not valid JSON, or is not a HAR.
 * Entries that cannot be read are skipped and reported as warnings.
 */
export function parseHar(input: Buffer | string): ParsedHar {
  let text = typeof input === 'string' ? input : input.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.trim() === '') {
    throw new HarError(ERROR_CODES.EMPTY_FILE, 'The file is empty.');
  }

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? shorten(error.message) : 'unknown error';
    throw new HarError(ERROR_CODES.INVALID_JSON, `The file is not valid JSON: ${reason}`);
  }

  if (!isObject(root) || !isObject(root['log'])) {
    throw new HarError(ERROR_CODES.NOT_A_HAR, 'The file is JSON but not a HAR: "log" is missing.');
  }
  const log = root['log'];
  const rawEntries = log['entries'];
  if (!Array.isArray(rawEntries)) {
    throw new HarError(
      ERROR_CODES.NOT_A_HAR,
      'The file is JSON but not a HAR: "log.entries" is missing or is not a list.',
    );
  }

  const warnings: HarWarning[] = [];
  const harVersion = asString(log['version']);
  if (harVersion === '') warnings.push({ message: 'The HAR has no "log.version".' });

  const entries: NormalizedEntry[] = [];
  rawEntries.forEach((raw, index) => {
    try {
      entries.push(
        normalizeEntry(raw, index, (message) =>
          warnings.push({ entryIndex: index, message: `Entry ${index}: ${message}.` }),
        ),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      warnings.push({ entryIndex: index, message: `Entry ${index} was skipped: ${reason}.` });
    }
  });

  const creator = isObject(log['creator'])
    ? [asString(log['creator']['name']), asString(log['creator']['version'])]
        .filter((part) => part !== '')
        .join(' ')
    : '';

  const parsed: ParsedHar = {
    harVersion,
    pageCount: Array.isArray(log['pages']) ? log['pages'].length : 0,
    entryCount: rawEntries.length,
    entries,
    warnings,
  };
  if (creator !== '') parsed.creator = creator;
  return parsed;
}
