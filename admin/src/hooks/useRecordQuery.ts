import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api-client';

/**
 * 'not_found' for a 404, or a 400 (the server rejected the id itself, e.g. a typo'd or truncated link that is not a
 * UUID); anything else (network, 5xx) is a retryable failure.
 */
export type RecordLoadErrorKind = 'not_found' | 'failed';

/** The RecordLoadErrorKind of a failed record load. */
export function recordLoadErrorKind(err: unknown): RecordLoadErrorKind {
  return err instanceof ApiError && (err.status === 404 || err.status === 400) ? 'not_found' : 'failed';
}

/**
 * Loads `fn(id)` for a record page card (or the record itself): re-runs when `id` changes, drops responses that arrive
 * after the id changed or the component unmounted, and offers `retry`. No toast: the caller shows the state inline.
 * `fn` may be an inline function; only `id` and `retry` trigger a load.
 */
export function useRecordQuery<T>(fn: (id: string) => Promise<T>, id: string | null | undefined) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<RecordLoadErrorKind | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) { setData(null); setLoading(false); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef.current(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(recordLoadErrorKind(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, loading, error, failed: error !== null, retry };
}
