import type { FastifyInstance } from 'fastify';
import {
  ERROR_CODES,
  compareEntries,
  type CompareResponse,
  type CompareSummaryResponse,
  type NormalizedEntry,
} from '@har-comparisor/shared';
import { HarError } from '../har/har-error.js';
import { parseHar } from '../har/parse-har.js';
import type { HarStore, StoredHar } from '../store/har-store.js';

const MAX_FILE_NAME_LENGTH = 255;

function readFileName(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return 'upload.har';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the raw value when it is not valid percent-encoding
  }
  const trimmed = decoded.trim().slice(0, MAX_FILE_NAME_LENGTH);
  return trimmed === '' ? 'upload.har' : trimmed;
}

function findHar(store: HarStore, id: string | undefined): StoredHar {
  const stored = id ? store.get(id) : undefined;
  if (!stored) {
    throw new HarError(ERROR_CODES.HAR_NOT_FOUND, 'This HAR is not loaded (or it expired).');
  }
  return stored;
}

function findEntry(stored: StoredHar, rawIndex: string | undefined): NormalizedEntry {
  const index = Number(rawIndex);
  if (rawIndex === undefined || rawIndex === '' || !Number.isInteger(index) || index < 0) {
    throw new HarError(ERROR_CODES.BAD_REQUEST, 'The entry index must be a whole number.');
  }
  const entry = stored.entriesByIndex.get(index);
  if (!entry) throw new HarError(ERROR_CODES.ENTRY_NOT_FOUND, `Entry ${index} does not exist.`);
  return entry;
}

interface CompareQuery {
  legacyHar?: string;
  legacyIndex?: string;
  newHar?: string;
  newIndex?: string;
  /** `false` returns only the comparison, without the two entries. */
  entries?: string;
}

export function registerHarRoutes(app: FastifyInstance, store: HarStore): void {
  // Uploads arrive as raw bytes, whatever the content type is.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.post('/api/hars', async (request, reply) => {
    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new HarError(ERROR_CODES.EMPTY_FILE, 'The file is empty.');
    }
    const parsed = parseHar(body);
    const stored = store.add(readFileName(request.headers['x-file-name']), body.length, parsed);
    return reply.code(201).send(store.toSummaryResponse(stored));
  });

  app.get<{ Params: { id: string } }>('/api/hars/:id', async (request) => {
    return store.toSummaryResponse(findHar(store, request.params.id));
  });

  app.get<{ Params: { id: string; index: string } }>(
    '/api/hars/:id/entries/:index',
    async (request) => findEntry(findHar(store, request.params.id), request.params.index),
  );

  app.delete<{ Params: { id: string } }>('/api/hars/:id', async (request, reply) => {
    store.delete(request.params.id);
    return reply.code(204).send();
  });

  /** Compares one legacy entry with one new entry. */
  app.get<{ Querystring: CompareQuery }>('/api/compare', async (request) => {
    const { legacyHar, legacyIndex, newHar, newIndex, entries } = request.query;
    const legacy = findEntry(findHar(store, legacyHar), legacyIndex);
    const next = findEntry(findHar(store, newHar), newIndex);
    const comparison = compareEntries(legacy, next);
    if (entries === 'false') {
      const summary: CompareSummaryResponse = { comparison };
      return summary;
    }
    const response: CompareResponse = { legacy, new: next, comparison };
    return response;
  });
}
