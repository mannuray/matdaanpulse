import { useState, useCallback, useRef, useEffect } from 'react';
import { searchConstituencies, searchCandidates } from '../../model/api/api';
import type { ConstituencySearchHit, Candidate } from '../../model/types';

/**
 * CONTROLLER: Global Search (MVC)
 * Standardizes search orchestration across constituencies and candidates.
 */
export function useGlobalSearch(electionId?: string) {
  const [query, setQuery] = useState('');
  const [constituencies, setConstituencies] = useState<ConstituencySearchHit[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const searchIdRef = useRef(0);

  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setConstituencies([]);
      setCandidates([]);
      setOpen(false);
      return;
    }

    const id = ++searchIdRef.current;
    setLoading(true);

    try {
      const [cResults, candResults] = await Promise.all([
        searchConstituencies(trimmed, electionId).catch(() => []),
        searchCandidates(trimmed, electionId).catch(() => []),
      ]);

      if (searchIdRef.current !== id) return;

      setConstituencies(cResults);
      setCandidates(candResults);
      setOpen(cResults.length > 0 || candResults.length > 0);
    } finally {
      if (searchIdRef.current === id) setLoading(false);
    }
  }, [electionId]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => performSearch(val), 300);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const reset = useCallback(() => {
    setQuery('');
    setConstituencies([]);
    setCandidates([]);
    setOpen(false);
  }, []);

  return {
    query,
    constituencies,
    candidates,
    loading,
    open,
    setOpen,
    handleQueryChange,
    close,
    reset,
    hasResults: constituencies.length > 0 || candidates.length > 0
  };
}
