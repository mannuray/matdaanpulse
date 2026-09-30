import { useState, useEffect, useCallback, useRef } from 'react';
import { describeApiError } from '../../model/api/api-client';

/**
 * Request Deduplicator (SOLID: SRP)
 * Ensures that multiple components calling the same API endpoint 
 * simultaneously only trigger a single network request.
 */
const pendingRequests = new Map<string, Promise<unknown>>();

function getDeduplicatedPromise<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * HOOK: useApi (MVC: Model Access)
 * Enhanced with request deduplication and stable dependency tracking.
 */
export function useApi<T>(
  fetcher: () => Promise<T>, 
  deps: unknown[] = [], 
  options: { key?: string } = {}
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(() => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    // If a key is provided, we deduplicate simultaneous requests
    const fetchPromise = options.key 
      ? getDeduplicatedPromise(options.key, fetcherRef.current)
      : fetcherRef.current();

    fetchPromise
      .then((result) => {
        if (requestIdRef.current === id) {
          setData(result);
        }
      })
      .catch((e) => {
        if (requestIdRef.current === id) {
          setError(describeApiError(e));
        }
      })
      .finally(() => {
        if (requestIdRef.current === id) {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}
