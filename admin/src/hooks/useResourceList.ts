import { describeError } from '../utils/api-error';
import { useState, useEffect, useRef, useCallback } from 'react';

interface ListOptions<F> {
  key: string;
  pageSize?: number;
  initialFilters: F;
  onLoad: (page: number, search: string, filters: F) => Promise<{ data: any[], total: number }>;
}

/**
 * HOOK: useResourceList (SOLID: SRP/OCP)
 * Standardizes paging, debounced searching, and filter persistence for Admin lists.
 */
export function useResourceList<F>({ key, pageSize = 25, initialFilters, onLoad }: ListOptions<F>) {
  const filterKey = `${key}_filters`;
  const searchKey = `${key}_search`;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => localStorage.getItem(searchKey) || '');
  const [filters, setFilters] = useState<F>(() => {
    const saved = localStorage.getItem(filterKey);
    return saved ? JSON.parse(saved) : initialFilters;
  });

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use a ref for onLoad to prevent infinite loops when inline functions are passed
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  const load = useCallback(async (p: number, s: string, f: F) => {
    setLoading(true);
    setError(null);
    try {
      const result = await onLoadRef.current(p, s, f);
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      const msg = describeError(err, `Failed to load ${key}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load(page, search, filters);
  }, [page, search, filters, load]);

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
    handleSearch, updateFilters, loadPage: (p: number) => load(p, search, filters),
    navigateWithScroll,
    refresh: () => load(page, search, filters)
  };
}
