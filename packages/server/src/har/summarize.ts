import type { EntrySummary, NormalizedEntry } from '@har-comparisor/shared';

function mainMimeType(mimeType: string | undefined): string {
  return (mimeType ?? '').split(';')[0]?.trim() ?? '';
}

export function summarizeEntry(entry: NormalizedEntry): EntrySummary {
  const { request, response } = entry;
  const summary: EntrySummary = {
    index: entry.index,
    startedDateTime: entry.startedDateTime,
    method: request.method,
    url: request.url,
    host: request.host,
    path: request.path,
    status: response.status,
    statusText: response.statusText,
    mimeType: mainMimeType(response.body?.mimeType),
    time: entry.time,
    hasRequestBody: request.body !== undefined,
    hasResponseBody: response.body !== undefined,
  };
  if (entry.resourceType !== undefined) summary.resourceType = entry.resourceType;
  if (response.body?.size !== undefined) summary.size = response.body.size;
  return summary;
}
