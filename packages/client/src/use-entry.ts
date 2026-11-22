import type { NormalizedEntry } from '@har-comparisor/shared';
import { fetchEntry } from './api';
import { useAsync, type AsyncState } from './use-async';

/** Loads the full entry for the selected row. */
export function useEntry(
  harId: string | undefined,
  index: number | undefined,
): AsyncState<NormalizedEntry> {
  const key = harId !== undefined && index !== undefined ? `${harId}:${index}` : undefined;
  return useAsync(key, () => fetchEntry(harId as string, index as number));
}
