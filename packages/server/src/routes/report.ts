import type { FastifyInstance } from 'fastify';
import {
  ERROR_CODES,
  buildReport,
  compareEntries,
  renderReport,
  type EntrySummary,
  type ReportFormat,
  type ReportPairInput,
} from '@har-comparisor/shared';
import { HarError } from '../har/har-error.js';
import type { HarStore, StoredHar } from '../store/har-store.js';

const FORMATS: Record<ReportFormat, { contentType: string; extension: string }> = {
  json: { contentType: 'application/json; charset=utf-8', extension: 'json' },
  text: { contentType: 'text/plain; charset=utf-8', extension: 'txt' },
  html: { contentType: 'text/html; charset=utf-8', extension: 'html' },
};

/** One pair as the app shows it: its number and whether it was called out of order. */
interface PairRequest {
  number: number;
  legacy: number;
  new: number;
  outOfOrder: boolean;
}

interface ReportRequestBody {
  legacyHar: string;
  newHar: string;
  format: ReportFormat;
  redact: boolean;
  pairs: PairRequest[];
}

function bad(message: string): HarError {
  return new HarError(ERROR_CODES.BAD_REQUEST, message);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIndex = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

/** Reads and checks the JSON body. Every field comes from the browser, so nothing is assumed. */
function readBody(raw: unknown): ReportRequestBody {
  if (!Buffer.isBuffer(raw) || raw.length === 0) throw bad('The report request is empty.');
  let body: unknown;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw bad('The report request is not valid JSON.');
  }
  if (!isObject(body)) throw bad('The report request must be a JSON object.');

  const { legacyHar, newHar, format, redact, pairs } = body;
  if (typeof legacyHar !== 'string' || typeof newHar !== 'string') {
    throw bad('Both HAR ids are required.');
  }
  if (typeof format !== 'string' || !Object.hasOwn(FORMATS, format)) {
    throw bad('The format must be json, text or html.');
  }
  if (redact !== undefined && typeof redact !== 'boolean') {
    throw bad('redact must be true or false.');
  }
  if (!Array.isArray(pairs)) throw bad('pairs must be a list.');

  const legacyUsed = new Set<number>();
  const newUsed = new Set<number>();
  const checked = pairs.map((pair: unknown): PairRequest => {
    if (
      !isObject(pair) ||
      !isIndex(pair['legacy']) ||
      !isIndex(pair['new']) ||
      !Number.isInteger(pair['number']) ||
      Number(pair['number']) < 1
    ) {
      throw bad('Each pair needs a number and the legacy and new entry indexes.');
    }
    const { legacy, new: next } = pair as { legacy: number; new: number };
    if (legacyUsed.has(legacy) || newUsed.has(next)) {
      throw bad('A request can belong to only one pair.');
    }
    legacyUsed.add(legacy);
    newUsed.add(next);
    return {
      number: pair['number'] as number,
      legacy,
      new: next,
      outOfOrder: pair['outOfOrder'] === true,
    };
  });

  return {
    legacyHar,
    newHar,
    format: format as ReportFormat,
    redact: redact ?? true,
    pairs: checked,
  };
}

function findHar(store: HarStore, id: string): StoredHar {
  const stored = store.get(id);
  if (!stored) {
    throw new HarError(ERROR_CODES.HAR_NOT_FOUND, 'This HAR is not loaded (or it expired).');
  }
  return stored;
}

function entryOf(
  stored: StoredHar,
  summaries: Map<number, EntrySummary>,
  index: number,
  side: string,
) {
  const entry = stored.entriesByIndex.get(index);
  const summary = summaries.get(index);
  if (!entry || !summary) {
    throw new HarError(ERROR_CODES.ENTRY_NOT_FOUND, `The ${side} entry ${index} does not exist.`);
  }
  return { entry, summary };
}

/** A file name safe for a download header: the two HAR names without their extension. */
function reportFileName(legacy: string, next: string, extension: string): string {
  const base = (name: string) =>
    name
      .replace(/\.har$/i, '')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 60);
  return `har-report_${base(legacy)}_vs_${base(next)}.${extension}`;
}

export function registerReportRoutes(app: FastifyInstance, store: HarStore): void {
  /** Builds a report for the pairs the user made, in the chosen format, as a download. */
  app.post('/api/report', async (request, reply) => {
    const body = readBody(request.body);
    const legacy = findHar(store, body.legacyHar);
    const next = findHar(store, body.newHar);

    const bySummaryIndex = (stored: StoredHar) =>
      new Map(stored.summaries.map((s) => [s.index, s]));
    const legacySummaries = bySummaryIndex(legacy);
    const newSummaries = bySummaryIndex(next);

    const pairs: ReportPairInput[] = body.pairs.map((pair) => {
      const l = entryOf(legacy, legacySummaries, pair.legacy, 'legacy');
      const n = entryOf(next, newSummaries, pair.new, 'new');
      return {
        number: pair.number,
        legacy: l.summary,
        new: n.summary,
        comparison: compareEntries(l.entry, n.entry),
        outOfOrder: pair.outOfOrder,
      };
    });

    const report = buildReport({
      generatedAt: new Date().toISOString(),
      redact: body.redact,
      legacy: { fileName: legacy.meta.fileName, entries: legacy.summaries },
      new: { fileName: next.meta.fileName, entries: next.summaries },
      pairs,
    });

    const { contentType, extension } = FORMATS[body.format];
    const fileName = reportFileName(legacy.meta.fileName, next.meta.fileName, extension);
    return reply
      .header('content-type', contentType)
      .header('content-disposition', `attachment; filename="${fileName}"`)
      .header('cache-control', 'no-store')
      .send(renderReport(report, body.format));
  });
}
