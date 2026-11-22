import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  port: number;
  host: string;
  /** Largest accepted upload, in bytes. */
  maxUploadBytes: number;
  /** How long an uploaded HAR stays in memory after its last access, in milliseconds. */
  sessionTtlMs: number;
  /** Most HARs kept in memory at once. The least recently used one is dropped first. */
  maxSessions: number;
  /** Folder with the built client, served when it exists. */
  clientDistDir: string;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number, got "${raw}"`);
  }
  return value;
}

export function loadConfig(): ServerConfig {
  const defaultClientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
  return {
    port: readNumber('PORT', 9096),
    host: process.env['HOST'] ?? '0.0.0.0',
    maxUploadBytes: readNumber('MAX_UPLOAD_MB', 1024) * 1024 * 1024,
    sessionTtlMs: readNumber('SESSION_TTL_MINUTES', 120) * 60 * 1000,
    maxSessions: readNumber('MAX_SESSIONS', 10),
    clientDistDir: process.env['CLIENT_DIST_DIR'] ?? defaultClientDist,
  };
}
