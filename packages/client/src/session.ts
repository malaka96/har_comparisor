import { EMPTY_FILTER, type FilterState } from './filter';
import { EMPTY_PAIRING, addPair, type PairingState } from './pairing';

/**
 * A saved session: which requests were paired, and the filter. It holds no HAR content,
 * only the file names and request counts, so the same HARs can be checked when it is loaded.
 */
export const SESSION_KIND = 'har-comparisor-session';
export const SESSION_VERSION = 1;

export interface SessionSide {
  fileName: string;
  requests: number;
}

export interface SessionFile {
  kind: typeof SESSION_KIND;
  version: typeof SESSION_VERSION;
  savedAt: string;
  legacy: SessionSide;
  new: SessionSide;
  pairs: Array<{ legacy: number; new: number }>;
  filter: FilterState;
}

export interface LoadedHar {
  fileName: string;
  /** Entry indexes in the HAR. */
  indexes: number[];
}

export function buildSession(
  legacy: LoadedHar,
  next: LoadedHar,
  pairing: PairingState,
  filter: FilterState,
  savedAt: string,
): SessionFile {
  return {
    kind: SESSION_KIND,
    version: SESSION_VERSION,
    savedAt,
    legacy: { fileName: legacy.fileName, requests: legacy.indexes.length },
    new: { fileName: next.fileName, requests: next.indexes.length },
    pairs: [...pairing.pairs]
      .sort((a, b) => a.legacy - b.legacy || a.new - b.new)
      .map((p) => ({ legacy: p.legacy, new: p.new })),
    filter,
  };
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

function readSide(value: unknown, label: string): SessionSide {
  if (!isObject(value) || typeof value['fileName'] !== 'string' || !isIndex(value['requests'])) {
    throw new SessionError(`The session file has no valid ${label} HAR details.`);
  }
  return { fileName: value['fileName'], requests: value['requests'] };
}

/** Keeps known filter values and falls back to "all" for anything else. */
function readFilter(value: unknown): FilterState {
  if (!isObject(value)) return EMPTY_FILTER;
  const text = (key: keyof FilterState) =>
    typeof value[key] === 'string' ? (value[key] as string) : EMPTY_FILTER[key];
  const status = text('status');
  const pair = text('pair');
  return {
    text: text('text'),
    method: text('method'),
    type: text('type'),
    status: (['all', '2xx', '3xx', '4xx', '5xx', 'failed'].includes(status)
      ? status
      : 'all') as FilterState['status'],
    pair: (['all', 'unpaired', 'paired', 'different', 'identical'].includes(pair)
      ? pair
      : 'all') as FilterState['pair'],
  };
}

/** Reads a session file. The file comes from the user's disk, so every field is checked. */
export function parseSession(text: string): SessionFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SessionError('The session file is not valid JSON.');
  }
  if (!isObject(value) || value['kind'] !== SESSION_KIND) {
    throw new SessionError('This is not a HAR Comparisor session file.');
  }
  if (value['version'] !== SESSION_VERSION) {
    throw new SessionError(`Session version ${String(value['version'])} is not supported.`);
  }
  const rawPairs = value['pairs'];
  if (!Array.isArray(rawPairs)) throw new SessionError('The session file has no list of pairs.');
  const pairs = rawPairs.map((pair: unknown) => {
    if (!isObject(pair) || !isIndex(pair['legacy']) || !isIndex(pair['new'])) {
      throw new SessionError('A pair in the session file is not valid.');
    }
    return { legacy: pair['legacy'], new: pair['new'] };
  });
  return {
    kind: SESSION_KIND,
    version: SESSION_VERSION,
    savedAt: typeof value['savedAt'] === 'string' ? value['savedAt'] : '',
    legacy: readSide(value['legacy'], 'legacy'),
    new: readSide(value['new'], 'new'),
    pairs,
    filter: readFilter(value['filter']),
  };
}

export interface AppliedSession {
  pairing: PairingState;
  filter: FilterState;
  /** Pairs restored. */
  restored: number;
  /** Plain warnings, for example when the loaded HARs differ from the saved ones. */
  warnings: string[];
}

function sideWarnings(label: string, saved: SessionSide, loaded: LoadedHar): string[] {
  const warnings: string[] = [];
  if (saved.fileName !== loaded.fileName) {
    warnings.push(
      `The ${label} HAR is ${loaded.fileName}, but the session was saved with ${saved.fileName}.`,
    );
  }
  if (saved.requests !== loaded.indexes.length) {
    warnings.push(
      `The ${label} HAR has ${loaded.indexes.length} requests, but the saved one had ${saved.requests}.`,
    );
  }
  return warnings;
}

/**
 * Rebuilds the pairs on the loaded HARs. Pairs that point at a request the HAR does not have,
 * or that reuse a request, are skipped and reported.
 */
export function applySession(
  session: SessionFile,
  legacy: LoadedHar,
  next: LoadedHar,
): AppliedSession {
  const warnings = [
    ...sideWarnings('legacy', session.legacy, legacy),
    ...sideWarnings('new', session.new, next),
  ];
  const legacyIndexes = new Set(legacy.indexes);
  const newIndexes = new Set(next.indexes);
  const usedLegacy = new Set<number>();
  const usedNew = new Set<number>();
  let pairing = EMPTY_PAIRING;
  let skipped = 0;
  for (const pair of session.pairs) {
    const fits =
      legacyIndexes.has(pair.legacy) &&
      newIndexes.has(pair.new) &&
      !usedLegacy.has(pair.legacy) &&
      !usedNew.has(pair.new);
    if (!fits) {
      skipped++;
      continue;
    }
    usedLegacy.add(pair.legacy);
    usedNew.add(pair.new);
    pairing = addPair(pairing, pair.legacy, pair.new);
  }
  if (skipped > 0) {
    warnings.push(
      `${skipped} saved pair${skipped === 1 ? '' : 's'} did not fit the loaded HARs and ${skipped === 1 ? 'was' : 'were'} skipped.`,
    );
  }
  return { pairing, filter: session.filter, restored: pairing.pairs.length, warnings };
}
