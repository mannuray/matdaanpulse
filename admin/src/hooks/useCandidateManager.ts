import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  getCandidates, searchCandidates, linkCandidatePerson, unlinkCandidatePerson 
} from '../services/candidate.service';
import { createPerson } from '../services/person.api';
import { getElections } from '../services/election.service';
import { getConstituencies } from '../services/constituency.service';
import { getStates } from '../services/geo.service';
import { enrichCandidates } from '../services/ai.service';
import { useToast } from '../context/ToastContext';
import type { Candidate, Constituency, Election, State } from '../types';

export type PersonFilter = 'all' | 'linked' | 'unlinked' | 'ai_enriched' | 'not_enriched';

/**
 * CONTROLLER: Candidate Manager (MVC)
 * Manages complex candidate data flows, search, and linking logic.
 */
export function useCandidateManager() {
  const { toast } = useToast();

  // 1. Data State
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);

  // 2. Filter State
  const [selectedElection, setSelectedElection] = useState(() => localStorage.getItem('admin_cand_election') || '');
  const [selectedConst, setSelectedConst] = useState(() => localStorage.getItem('admin_cand_const') || '');
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all');
  const [search, setSearch] = useState('');

  // 3. Global Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState<Candidate[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // 4. Linking Logic State
  const [linkingSuggestions, setLinkingSuggestions] = useState<
    Map<string, { candidate: Candidate; matches: Candidate[] }>
  >(new Map());
  const [selectedMatches, setSelectedMatches] = useState<Map<string, Set<string>>>(new Map());
  const [enriching, setEnriching] = useState(false);

  // Fetch initial master data
  useEffect(() => {
    getElections().then(setElections).catch(() => {});
    getStates().then(setStates).catch(() => {});
  }, []);

  // Fetch constituencies when election changes
  useEffect(() => {
    if (!selectedElection) {
      setConstituencies([]);
      return;
    }
    localStorage.setItem('admin_cand_election', selectedElection);
    getConstituencies(selectedElection).then(setConstituencies).catch(() => {});
  }, [selectedElection]);

  // Fetch candidates when constituency changes
  const loadCandidates = useCallback(async () => {
    if (!selectedElection || !selectedConst) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem('admin_cand_const', selectedConst);
      const data = await getCandidates(selectedElection, selectedConst);
      setCandidates(data.filter(c => c.party_id !== 'NOTA' && c.name !== 'NOTA'));
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedElection, selectedConst]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  // Helper for naming comparison
  const constBaseName = useCallback((constId: string) => {
    const vsMatch = constId.match(/^[A-Z]+_VS\d*_(.+)$/);
    if (vsMatch) return vsMatch[1];
    return constId;
  }, []);

  // Compute linking suggestions (Background logic)
  useEffect(() => {
    if (candidates.length === 0) return;
    const unlinked = candidates.filter(c => !c.person_id);
    if (unlinked.length === 0) {
      setLinkingSuggestions(new Map());
      setSelectedMatches(new Map());
      return;
    }

    const suggestions = new Map<string, { candidate: Candidate; matches: Candidate[] }>();
    const preselected = new Map<string, Set<string>>();
    let cancelled = false;

    (async () => {
      for (const c of unlinked) {
        if (cancelled) break;
        try {
          const results = await searchCandidates(c.name);
          const matches = results.filter(
            r => r.id !== c.id && r.election_id !== c.election_id &&
              r.name.toUpperCase().trim() === c.name.toUpperCase().trim(),
          );
          if (matches.length > 0) {
            suggestions.set(c.id, { candidate: c, matches });
            const myBase = constBaseName(c.const_id);
            const checked = new Set<string>();
            matches.forEach(m => {
              if (constBaseName(m.const_id) === myBase) checked.add(m.id);
            });
            preselected.set(c.id, checked);
          }
        } catch {}
      }
      if (!cancelled) {
        setLinkingSuggestions(new Map(suggestions));
        setSelectedMatches(new Map(preselected));
      }
    })();

    return () => { cancelled = true; };
  }, [candidates, constBaseName]);

  // Global search debouncing
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!globalSearch || globalSearch.trim().length < 2) {
      setGlobalResults([]);
      return;
    }
    setGlobalLoading(true);
    searchTimer.current = setTimeout(() => {
      searchCandidates(globalSearch.trim())
        .then(data => setGlobalResults(data.filter(c => c.party_id !== 'NOTA' && c.name !== 'NOTA')))
        .catch(() => setGlobalResults([]))
        .finally(() => setGlobalLoading(false));
    }, 300);
  }, [globalSearch]);

  // ── ACTIONS ──

  const toggleMatch = (candidateId: string, matchId: string) => {
    setSelectedMatches(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(candidateId) || []);
      if (set.has(matchId)) set.delete(matchId); else set.add(matchId);
      next.set(candidateId, set);
      return next;
    });
  };

  const handleLink = async (candidateId: string, matches: Candidate[]) => {
    const checked = selectedMatches.get(candidateId);
    const toLink = matches.filter(m => checked?.has(m.id));
    if (toLink.length === 0) { toast('Select at least one match to link', 'error'); return; }

    try {
      const existingPersonId = toLink.find(m => m.person_id)?.person_id;
      let personId = existingPersonId;

      if (!personId) {
        const candidate = candidates.find(c => c.id === candidateId);
        const person = await createPerson(candidate?.name || 'Unknown');
        personId = person.id;
      }

      await linkCandidatePerson(candidateId, personId!);
      for (const match of toLink) {
        if (!match.person_id) await linkCandidatePerson(match.id, personId!);
      }

      toast(`Successfully linked ${toLink.length + 1} records`);
      loadCandidates();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Linking failed', 'error');
    }
  };

  const handleUnlink = async (candidateId: string) => {
    if (!confirm('Unlink this candidate from the master record?')) return;
    try {
      await unlinkCandidatePerson(candidateId);
      toast('Candidate unlinked');
      loadCandidates();
    } catch { toast('Unlink failed', 'error'); }
  };

  const runEnrichment = async () => {
    if (!selectedElection) return;
    setEnriching(true);
    try {
      const res = await enrichCandidates(selectedElection);
      toast(`AI enrichment queued for ${res.total} candidates`);
    } catch { toast('Enrichment failed', 'error'); }
    finally { setEnriching(false); }
  };

  // ── VIEW MODEL ──

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (personFilter === 'linked') return !!c.person_id;
      if (personFilter === 'unlinked') return !c.person_id;
      if (personFilter === 'ai_enriched') return !!(c.metadata as any)?.ai_profile;
      if (personFilter === 'not_enriched') return !(c.metadata as any)?.ai_profile;
      return true;
    });
  }, [candidates, personFilter]);

  return {
    elections, states, constituencies, selectedElection, setSelectedElection,
    selectedConst, setSelectedConst, personFilter, setPersonFilter,
    candidates: filteredCandidates, loading, 
    globalSearch, setGlobalSearch, globalResults, globalLoading,
    linkingSuggestions, selectedMatches, toggleMatch, handleLink, handleUnlink,
    enriching, runEnrichment, refresh: loadCandidates
  };
}
