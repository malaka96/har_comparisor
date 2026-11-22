import type { ApiErrorBody, HarSummaryResponse, NormalizedEntry } from '@har-comparisor/shared';

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error?.message) return new ApiError(body.error.code ?? 'UNKNOWN', body.error.message);
  } catch {
    // The body was not JSON. Fall through to the generic message.
  }
  return new ApiError('UNKNOWN', `The server answered with status ${response.status}.`);
}

async function request(input: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the server. Is it running?');
  }
  if (!response.ok) throw await toApiError(response);
  return response;
}

export async function uploadHar(file: File): Promise<HarSummaryResponse> {
  const response = await request('/api/hars', {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  });
  return (await response.json()) as HarSummaryResponse;
}

export async function deleteHar(id: string): Promise<void> {
  await request(`/api/hars/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchEntry(harId: string, index: number): Promise<NormalizedEntry> {
  const response = await request(`/api/hars/${encodeURIComponent(harId)}/entries/${index}`);
  return (await response.json()) as NormalizedEntry;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
