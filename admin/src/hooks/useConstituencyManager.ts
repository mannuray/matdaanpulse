import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getAdminConstituencies, bulkTagConstituencies, computeConstituencyAnalysis } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import { useSelection } from './useSelection';
import type { Constituency } from '../types';

export const CONSTITUENCY_PAGE_SIZE = 100;

/**
 * CONTROLLER: Constituency Manager (MVC)
 * One page of the global election's seats (server search + paging), client-side district/tag filters on that
 * page, and bulk tagging of the visible rows.
 */
export function useConstituencyManager(electionId: string) {
  const { toast, toastError } = useToast();

  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearchState] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [computing, setComputing] = useState(false);

  // The page belongs to one election: switching election reads page 1 at once (no fetch of the old page number).
  const [pageState, setPageState] = useState({ electionId, page: 1 });
  const page = pageState.electionId === electionId ? pageState.page : 1;
  const setPage = useCallback((p: number) => setPageState({ electionId, page: Math.max(1, p) }), [electionId]);
  const setSearch = (s: string) => { setSearchState(s); setPageState({ electionId, page: 1 }); };

  // A request counter drops late responses (fast typing, quick paging).
  const requestRef = useRef(0);
  const loadData = useCallback(async () => {
    const req = ++requestRef.current;
    if (!electionId) {
      setConstituencies([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const response = await getAdminConstituencies(electionId, page, CONSTITUENCY_PAGE_SIZE, search || undefined);
      if (req !== requestRef.current) return;
      setConstituencies(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      if (req === requestRef.current) toastError(err, 'Failed to load constituencies');
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, [electionId, page, search, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    constituencies.forEach(c => { if (c.district?.name) set.add(c.district.name); });
    return Array.from(set).sort();
  }, [constituencies]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    constituencies.forEach(c => {
      const tags = (c.metadata?.tags as string[]) || [];
      tags.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [constituencies]);

  const filteredConstituencies = useMemo(() => {
    return constituencies.filter(c => {
      if (districtFilter && c.district?.name !== districtFilter) return false;
      if (tagFilter) {
        const tags = (c.metadata?.tags as string[]) || [];
        if (!tags.includes(tagFilter)) return false;
      }
      return true;
    });
  }, [constituencies, districtFilter, tagFilter]);

  // Select-all and bulk tag act on the visible (filtered) rows only; any change of what is visible clears it.
  const selection = useSelection<Constituency>(filteredConstituencies);
  const { clear } = selection;
  useEffect(() => { clear(); }, [electionId, page, search, districtFilter, tagFilter, clear]);

  const bulkAddTag = async (tag: string) => {
    if (selection.selectedIds.size === 0 || !tag) return;
    try {
      await bulkTagConstituencies(Array.from(selection.selectedIds), [tag], []);
      toast('Bulk tag applied');
      loadData();
      selection.clear();
    } catch (err) {
      toastError(err, 'Bulk tag failed');
    }
  };

  const computeAnalysis = async () => {
    if (!electionId || computing) return;
    setComputing(true);
    try {
      await computeConstituencyAnalysis(electionId, []);
      toast('Analysis computation queued');
    } catch (err) {
      toastError(err, 'Failed to start computation');
    } finally {
      setComputing(false);
    }
  };

  return {
    constituencies: filteredConstituencies, loading,
    search, setSearch, districtFilter, setDistrictFilter, tagFilter, setTagFilter,
    page, totalPages: Math.max(1, Math.ceil(total / CONSTITUENCY_PAGE_SIZE)), total,
    allDistricts, allTags, selection, computing,
    bulkAddTag, computeAnalysis, loadPage: setPage, refresh: loadData
  };
}
