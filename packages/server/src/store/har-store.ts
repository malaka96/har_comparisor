import { randomUUID } from 'node:crypto';
import type {
  EntrySummary,
  HarMetadata,
  HarSummaryResponse,
  NormalizedEntry,
} from '@har-comparisor/shared';
import type { ParsedHar } from '../har/parse-har.js';
import { summarizeEntry } from '../har/summarize.js';

export interface StoredHar {
  meta: HarMetadata;
  summaries: EntrySummary[];
  entriesByIndex: Map<number, NormalizedEntry>;
  lastAccess: number;
}

export interface HarStoreOptions {
  /** Time a HAR stays in memory after its last access, in milliseconds. */
  ttlMs: number;
  /** Most HARs kept at once. The least recently used one is dropped first. */
  maxSessions: number;
  /** Clock used for expiry. Replaced in tests. */
  now?: () => number;
}

/** Keeps parsed HARs in memory only. Nothing is written to disk. */
export class HarStore {
  private readonly items = new Map<string, StoredHar>();
  private readonly ttlMs: number;
  private readonly maxSessions: number;
  private readonly now: () => number;
  private timer: NodeJS.Timeout | undefined;

  constructor(options: HarStoreOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSessions = options.maxSessions;
    this.now = options.now ?? Date.now;
  }

  add(fileName: string, sizeBytes: number, parsed: ParsedHar): StoredHar {
    this.removeExpired();
    while (this.items.size >= this.maxSessions) this.removeLeastRecentlyUsed();

    const now = this.now();
    const meta: HarMetadata = {
      id: randomUUID(),
      fileName,
      sizeBytes,
      uploadedAt: new Date(now).toISOString(),
      harVersion: parsed.harVersion,
      pageCount: parsed.pageCount,
      entryCount: parsed.entryCount,
      skippedCount: parsed.entryCount - parsed.entries.length,
      warnings: parsed.warnings,
    };
    if (parsed.creator !== undefined) meta.creator = parsed.creator;

    const stored: StoredHar = {
      meta,
      summaries: parsed.entries.map(summarizeEntry),
      entriesByIndex: new Map(parsed.entries.map((entry) => [entry.index, entry])),
      lastAccess: now,
    };
    this.items.set(meta.id, stored);
    return stored;
  }

  /** Returns a stored HAR and keeps it alive. Returns undefined when it is unknown or expired. */
  get(id: string): StoredHar | undefined {
    const stored = this.items.get(id);
    if (!stored) return undefined;
    if (this.now() - stored.lastAccess > this.ttlMs) {
      this.items.delete(id);
      return undefined;
    }
    stored.lastAccess = this.now();
    return stored;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  get size(): number {
    return this.items.size;
  }

  toSummaryResponse(stored: StoredHar): HarSummaryResponse {
    return { ...stored.meta, entries: stored.summaries };
  }

  removeExpired(): void {
    const now = this.now();
    for (const [id, stored] of this.items) {
      if (now - stored.lastAccess > this.ttlMs) this.items.delete(id);
    }
  }

  /** Starts a periodic cleanup that does not keep the process alive. */
  startCleanup(intervalMs = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.removeExpired(), intervalMs);
    this.timer.unref();
  }

  stopCleanup(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private removeLeastRecentlyUsed(): void {
    let oldestId: string | undefined;
    let oldestAccess = Infinity;
    for (const [id, stored] of this.items) {
      if (stored.lastAccess < oldestAccess) {
        oldestAccess = stored.lastAccess;
        oldestId = id;
      }
    }
    if (oldestId !== undefined) this.items.delete(oldestId);
  }
}
