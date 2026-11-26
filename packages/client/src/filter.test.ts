import { describe, expect, it } from 'vitest';
import type { EntrySummary } from '@har-comparisor/shared';
import type { MarkerTone } from './components/EntryTable';
import { EMPTY_FILTER, distinctValues, filterEntries, isFilterActive } from './filter';

function summary(index: number, overrides: Partial<EntrySummary>): EntrySummary {
  return {
    index,
    startedDateTime: '',
    method: 'GET',
    url: `https://api.example.test/item/${index}`,
    host: 'api.example.test',
    path: `/item/${index}`,
    status: 200,
    statusText: 'OK',
    resourceType: 'xhr',
    mimeType: 'application/json',
    time: 1,
    hasRequestBody: false,
    hasResponseBody: true,
    ...overrides,
  };
}

const entries = [
  summary(0, { url: 'https://api.example.test/api/Users?page=1' }),
  summary(1, { method: 'POST', url: 'https://api.example.test/api/orders', status: 500 }),
  summary(2, { url: 'https://cdn.example.test/logo.png', resourceType: 'image', status: 304 }),
  summary(3, { url: 'https://api.example.test/api/offline', status: 0, resourceType: 'fetch' }),
  summary(4, { url: 'https://api.example.test/api/missing', status: 404 }),
];

const tones: Record<number, MarkerTone> = {
  0: 'identical',
  1: 'different',
  2: 'missing',
  3: 'pending',
  4: 'extra',
};
const toneOf = (i: number) => tones[i];
const indexes = (list: EntrySummary[]) => list.map((e) => e.index);
const run = (filter: Partial<typeof EMPTY_FILTER>) =>
  indexes(filterEntries(entries, { ...EMPTY_FILTER, ...filter }, toneOf));

describe('filterEntries', () => {
  it('returns the same list when no filter is set', () => {
    expect(filterEntries(entries, EMPTY_FILTER, toneOf)).toBe(entries);
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, text: '   ' })).toBe(false);
  });

  it('searches the URL without regard to letter case, including the query string', () => {
    expect(run({ text: 'users' })).toEqual([0]);
    expect(run({ text: 'PAGE=1' })).toEqual([0]);
    expect(run({ text: ' /api/ ' })).toEqual([0, 1, 3, 4]);
    expect(run({ text: 'nothing-like-this' })).toEqual([]);
  });

  it('filters by method', () => {
    expect(run({ method: 'POST' })).toEqual([1]);
  });

  it('filters by status class, with status 0 as failed', () => {
    expect(run({ status: '2xx' })).toEqual([0]);
    expect(run({ status: '3xx' })).toEqual([2]);
    expect(run({ status: '4xx' })).toEqual([4]);
    expect(run({ status: '5xx' })).toEqual([1]);
    expect(run({ status: 'failed' })).toEqual([3]);
  });

  it('filters by type, with "api" meaning XHR and fetch', () => {
    expect(run({ type: 'api' })).toEqual([0, 1, 3, 4]);
    expect(run({ type: 'image' })).toEqual([2]);
  });

  it('filters by pair state', () => {
    expect(run({ pair: 'unpaired' })).toEqual([2, 4]);
    expect(run({ pair: 'paired' })).toEqual([0, 1, 3]);
    expect(run({ pair: 'different' })).toEqual([1]);
    expect(run({ pair: 'identical' })).toEqual([0]);
  });

  it('combines filters', () => {
    expect(run({ text: 'api', status: '2xx', method: 'GET' })).toEqual([0]);
    expect(run({ type: 'api', pair: 'unpaired' })).toEqual([4]);
  });
});

describe('distinctValues', () => {
  it('collects sorted distinct values across lists, skipping empty ones', () => {
    const other = [summary(9, { method: 'DELETE', resourceType: undefined })];
    expect(distinctValues([entries, other, undefined], (e) => e.method)).toEqual([
      'DELETE',
      'GET',
      'POST',
    ]);
    expect(distinctValues([entries, other], (e) => e.resourceType)).toEqual([
      'fetch',
      'image',
      'xhr',
    ]);
  });
});
