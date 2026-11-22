export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTime(ms: number): string {
  if (ms < 0) return '';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export type StatusClass = 'ok' | 'redirect' | 'client-error' | 'server-error' | 'failed';

export function statusClass(status: number): StatusClass {
  if (status >= 500) return 'server-error';
  if (status >= 400) return 'client-error';
  if (status >= 300) return 'redirect';
  if (status >= 200) return 'ok';
  return 'failed';
}

export function statusLabel(status: number): string {
  return status === 0 ? 'failed' : String(status);
}
