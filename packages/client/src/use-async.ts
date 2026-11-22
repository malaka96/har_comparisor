import { useEffect, useState } from 'react';
import { errorMessage } from './api';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; value: T };

interface Result<T> {
  key: string;
  value?: T;
  error?: string;
}

/**
 * Runs `load` whenever `key` changes and returns its state.
 * A `key` of undefined means there is nothing to load.
 * Results of an older key are ignored when the key changes before they arrive.
 */
export function useAsync<T>(key: string | undefined, load: () => Promise<T>): AsyncState<T> {
  const [result, setResult] = useState<Result<T>>();

  useEffect(() => {
    if (key === undefined) return;
    let cancelled = false;
    load()
      .then((value) => {
        if (!cancelled) setResult({ key, value });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key, error: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
    // `load` is expected to depend only on what `key` describes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (key === undefined) return { status: 'idle' };
  if (result?.key !== key) return { status: 'loading' };
  if (result.error !== undefined) return { status: 'error', message: result.error };
  return { status: 'loaded', value: result.value as T };
}
