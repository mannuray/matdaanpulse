import { describeError } from '../utils/api-error';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/** Typing pauses this long before a list search is sent. */
export const SEARCH_DEBOUNCE_MS = 300;

interface ListOptions<F> {
  key: string;
  pageSize?: number;
  initialFilters: F;
  /** Search to start with (e.g. from `?q=`); wins over the remembered search when non-empty. */
  initialSearch?: string | null;
  /** Repair filters restored from localStorage (e.g. drop options that no longer exist). */
  sanitizeFilters?: (restored: F) => F;
  onLoad: (page: number, search: string, filters: F) => Promise<{ data: any[], total: number }>;
}

function readFilters<F>(storageKey: string, initial: F): F {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initial;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...initial, ...(parsed as Partial<F>) } : initial;
  } catch {
    return initial;
  }
}

/**
 * HOOK: useResourceList (SOLID: SRP/OCP)
 * Standardizes paging, searching, and filter persistence for Admin lists.
 * The search box value (`search`) is immediate; the request uses it once typing pauses (SEARCH_DEBOUNCE_MS).
 * Only the latest request's response is applied.
 */
export function useResourceList<F>({ key, pageSize = 25, initialFilters, initialSearch, sanitizeFilters, onLoad }: ListOptions<F>) {
  const filterKey = `${key}_filters`;
  const searchKey = `${key}_search`;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => initialSearch || localStorage.getItem(searchKey) || '');
  const [filters, setFilters] = useState<F>(() => {
    const restored = readFilters(filterKey, initialFilters);
    return sanitizeFilters ? sanitizeFilters(restored) : restored;
  });
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  // The first load starts on mount, so a deep-linked panel says "Loading…" (not "not found") until it lands.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use a ref for onLoad to prevent infinite loops when inline functions are passed
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);
  const latestRequest = useRef(0);

  const load = useCallback(async (p: number, s: string, f: F) => {
    const request = ++latestRequest.current;
    const isLatest = () => request === latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await onLoadRef.current(p, s, f);
      if (!isLatest()) return;
      setItems(result.data);
      setTotal(result.total);
      // The page emptied (e.g. its last row left a status filter): step back to the new last page.
      if (result.data.length === 0 && p > 1) setPage(Math.max(1, Math.ceil(result.total / pageSize)));
    } catch (err) {
      if (!isLatest()) return;
      setError(describeError(err, `Failed to load ${key}`));
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [key, pageSize]);

  useEffect(() => {
    void load(page, query, filters);
  }, [page, query, filters, load]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    localStorage.setItem(searchKey, val);
  };

  const updateFilters = (newFilters: Partial<F>) => {
    setFilters(prev => {
      const next = { ...prev, ...newFilters };
      localStorage.setItem(filterKey, JSON.stringify(next));
      return next;
    });
    setPage(1);
  };

  const navigateWithScroll = (cb: () => void) => {
    sessionStorage.setItem(`${key}_scroll`, window.scrollY.toString());
    cb();
  };

  return {
    items, total, page, setPage, error,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    loading, search, filters,
    handleSearch, updateFilters,
    /** Go to page `p`; the effect above loads it (calling load directly left `page` behind). */
    loadPage: (p: number) => setPage(Math.max(1, p)),
    navigateWithScroll,
    refresh: () => load(page, query, filters)
  };
}
