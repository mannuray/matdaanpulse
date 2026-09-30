import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAdminConstituencies, bulkTagConstituencies, computeConstituencyAnalysis } from '../services/constituency.service';
import { getElections } from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { useSelection } from './useSelection';
import type { Constituency, Election, State } from '../types';

/**
 * CONTROLLER: Constituency Manager (MVC)
 * Handles data fetching, filtering, and bulk operations.
 */
export function useConstituencyManager() {
  const { toast } = useToast();
  
  // Master Data
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState(() => localStorage.getItem('admin_const_election') || '');
  
  // List State
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const selection = useSelection<Constituency>(constituencies);
  const [computing, setComputing] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    getElections().then(setElections).catch(() => {});
    getStates().then(setStates).catch(() => {});
  }, []);

  // 2. Fetch constituencies
  const loadData = useCallback(async () => {
    if (!selectedElectionId) {
      setConstituencies([]);
      return;
    }
    setLoading(true);
    try {
      const response = await getAdminConstituencies(selectedElectionId, page, 100, search || undefined);
      setConstituencies(response.data);
      setTotal(response.pagination.total);
    } catch {
      toast('Failed to load constituencies', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedElectionId, page, search, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedElectionId) {
      localStorage.setItem('admin_const_election', selectedElectionId);
    }
  }, [selectedElectionId]);

  // 3. Computed Filters
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

  // 4. Actions
  const bulkAddTag = async (tag: string) => {
    if (selection.selectedIds.size === 0 || !tag) return;
    try {
      await bulkTagConstituencies(Array.from(selection.selectedIds), [tag], []);
      toast('Bulk tag applied');
      loadData();
      selection.clear();
    } catch {
      toast('Bulk tag failed', 'error');
    }
  };

  const computeAnalysis = async () => {
    if (!selectedElectionId || computing) return;
    setComputing(true);
    try {
      // For simplicity, passing empty history for now or derive from manifest if available
      await computeConstituencyAnalysis(selectedElectionId, []);
      toast('Analysis computation queued');
    } catch {
      toast('Failed to start computation', 'error');
    } finally {
      setComputing(false);
    }
  };

  return {
    elections, states, selectedElection: selectedElectionId, setSelectedElection: setSelectedElectionId,
    constituencies: filteredConstituencies, loading,
    search, setSearch, districtFilter, setDistrictFilter, tagFilter, setTagFilter,
    page, totalPages: Math.ceil(total / 100), total,
    allDistricts, allTags, selection, computing,
    bulkAddTag, computeAnalysis, loadPage: setPage, refresh: loadData
  };
}
