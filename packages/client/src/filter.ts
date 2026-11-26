import type { EntrySummary } from '@har-comparisor/shared';
import type { MarkerTone } from './components/EntryTable';

export type StatusFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'failed';
export type PairFilter = 'all' | 'unpaired' | 'paired' | 'different' | 'identical';
/** `api` means XHR and fetch requests. Any other value is one browser resource type. */
export type TypeFilter = 'all' | 'api' | string;

export interface FilterState {
  /** Matched against the URL, without regard to letter case. */
  text: string;
  /** `all` or one HTTP method. */
  method: string;
  status: StatusFilter;
  type: TypeFilter;
  pair: PairFilter;
}

export const EMPTY_FILTER: FilterState = {
  text: '',
  method: 'all',
  status: 'all',
  type: 'all',
  pair: 'all',
};

export function isFilterActive(filter: FilterState): boolean {
  return (
    filter.text.trim() !== '' ||
    filter.method !== 'all' ||
    filter.status !== 'all' ||
    filter.type !== 'all' ||
    filter.pair !== 'all'
  );
}

function statusMatches(status: number, filter: StatusFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'failed':
      return status === 0;
    default:
      return Math.floor(status / 100) === Number(filter[0]);
  }
}

function typeMatches(type: string | undefined, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'api') return type === 'xhr' || type === 'fetch';
  return type === filter;
}

function pairMatches(tone: MarkerTone | undefined, filter: PairFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unpaired':
      return tone === 'missing' || tone === 'extra' || tone === undefined;
    case 'paired':
      return tone !== undefined && tone !== 'missing' && tone !== 'extra';
    case 'different':
      return tone === 'different';
    case 'identical':
      return tone === 'identical';
  }
}

/**
 * Returns the entries that match every part of the filter, in their original order.
 * `toneOf` gives the pair marker of an entry, used by the pair filter.
 */
export function filterEntries(
  entries: EntrySummary[],
  filter: FilterState,
  toneOf: (index: number) => MarkerTone | undefined,
): EntrySummary[] {
  if (!isFilterActive(filter)) return entries;
  const text = filter.text.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (text === '' || entry.url.toLowerCase().includes(text)) &&
      (filter.method === 'all' || entry.method === filter.method) &&
      statusMatches(entry.status, filter.status) &&
      typeMatches(entry.resourceType, filter.type) &&
      pairMatches(toneOf(entry.index), filter.pair),
  );
}

/** Distinct values of one field across both HARs, sorted, for the filter dropdowns. */
export function distinctValues(
  lists: Array<EntrySummary[] | undefined>,
  pick: (entry: EntrySummary) => string | undefined,
): string[] {
  const values = new Set<string>();
  for (const list of lists) {
    for (const entry of list ?? []) {
      const value = pick(entry);
      if (value) values.add(value);
    }
  }
  return [...values].sort();
}
