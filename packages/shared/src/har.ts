/** A name and value pair, used for headers, query parameters and form parameters. */
export interface NameValue {
  name: string;
  value: string;
}

export interface NormalizedBody {
  /** MIME type as recorded, for example `application/json`. Empty when unknown. */
  mimeType: string;
  /** Body text as recorded. When `encoding` is `base64`, this is Base64 text. */
  text?: string;
  encoding?: 'base64';
  /** Size recorded by the browser in bytes, when known. */
  size?: number;
  /** Form parameters of a request, when the browser recorded them. */
  params?: NameValue[];
}

export interface NormalizedRequest {
  method: string;
  url: string;
  scheme: string;
  host: string;
  /** Path without the query string. */
  path: string;
  query: NameValue[];
  httpVersion: string;
  headers: NameValue[];
  body?: NormalizedBody;
}

export interface NormalizedResponse {
  /** HTTP status. 0 means no response was received (failed or cancelled request). */
  status: number;
  statusText: string;
  httpVersion: string;
  headers: NameValue[];
  redirectUrl: string;
  body?: NormalizedBody;
}

export interface NormalizedTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  ssl?: number;
  send?: number;
  wait?: number;
  receive?: number;
}

export interface NormalizedEntry {
  /** Position of the entry in the HAR file. Stays stable even when other entries are skipped. */
  index: number;
  startedDateTime: string;
  /** Total time in milliseconds. -1 when unknown. */
  time: number;
  /** Browser resource type, for example `xhr` or `fetch`. */
  resourceType?: string;
  serverIpAddress?: string;
  request: NormalizedRequest;
  response: NormalizedResponse;
  timings: NormalizedTimings;
}

/** The short form of an entry used in lists. */
export interface EntrySummary {
  index: number;
  startedDateTime: string;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  resourceType?: string;
  /** MIME type of the response. */
  mimeType: string;
  time: number;
  /** Response body size in bytes, when known. */
  size?: number;
  hasRequestBody: boolean;
  hasResponseBody: boolean;
}

export interface HarWarning {
  /** Index of the affected entry, when the warning belongs to one entry. */
  entryIndex?: number;
  message: string;
}

export interface HarMetadata {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  harVersion: string;
  creator?: string;
  pageCount: number;
  /** Number of entries in the file, including skipped ones. */
  entryCount: number;
  /** Number of entries that were skipped because they could not be read. */
  skippedCount: number;
  warnings: HarWarning[];
}

/** Response of the upload endpoint and the endpoint that returns a loaded HAR. */
export interface HarSummaryResponse extends HarMetadata {
  entries: EntrySummary[];
}
