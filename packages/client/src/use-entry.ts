import { useEffect, useState } from 'react';
import type { NormalizedEntry } from '@har-comparisor/shared';
import { errorMessage, fetchEntry } from './api';

export type EntryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; entry: NormalizedEntry };

interface Result {
  key: string;
  entry?: NormalizedEntry;
  error?: string;
}

/** Loads the full entry for the selected row. */
export function useEntry(harId: string | undefined, index: number | undefined): EntryState {
  const key = harId !== undefined && index !== undefined ? `${harId}:${index}` : undefined;
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    if (key === undefined || harId === undefined || index === undefined) return;
    let cancelled = false;
    fetchEntry(harId, index)
      .then((entry) => {
        if (!cancelled) setResult({ key, entry });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key, error: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, harId, index]);

  if (key === undefined) return { status: 'idle' };
  if (result?.key !== key) return { status: 'loading' };
  if (result.error !== undefined) return { status: 'error', message: result.error };
  if (result.entry) return { status: 'loaded', entry: result.entry };
  return { status: 'loading' };
}
