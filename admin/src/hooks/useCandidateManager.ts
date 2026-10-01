import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getCandidates, searchCandidates, linkCandidatePerson, createCandidate } from '../services/candidate.service';
import { createPerson } from '../services/person.api';
import { getConstituencies } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import type { Candidate, Constituency } from '../types';

export type PersonFilter = 'all' | 'linked' | 'unlinked';
/** Which load failed: the election's seats, or the selected seat's candidates. */
export type CandidateLoadError = 'seats' | 'candidates' | null;
export interface LinkSuggestion { candidate: Candidate; matches: Candidate[] }
/** Body of POST /admin/candidates (backend CreateCandidateDto). */
export interface NewCandidate { election_id: string; const_id: string; name: string; party_id: string; metadata: Record<string, unknown> }

const isNota = (c: Candidate) => c.party_id === 'NOTA' || c.name === 'NOTA';

/**
 * CONTROLLER: Candidate Manager (MVC)
 * Candidates of one seat in the global election, person-link filters, and same-name link suggestions.
 * Cross-election candidate search lives in the ⌘K palette.
 */
export function useCandidateManager(electionId: string) {
  const { toast, toastError } = useToast();

  // Seats are tagged with their election, so a render right after an election switch never pairs
  // the new election with the old election's seat (no getCandidates(newElection, oldSeat) call).
  const [seats, setSeats] = useState<{ electionId: string; list: Constituency[] }>({ electionId: '', list: [] });
  const constituencies = useMemo(() => (seats.electionId === electionId ? seats.list : []), [seats, electionId]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  // The election whose seats failed to load (so a switch to another election never shows a stale error).
  const [seatsFailedFor, setSeatsFailedFor] = useState<string | null>(null);
  const [seatsReload, setSeatsReload] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesFailed, setCandidatesFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedConst, setSelectedConst] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all');
  const [search, setSearch] = useState('');

  const [linkingSuggestions, setLinkingSuggestions] = useState<Map<string, LinkSuggestion>>(new Map());
  const [selectedMatches, setSelectedMatches] = useState<Map<string, Set<string>>>(new Map());

  // Seats of the selected election, by seat number.
  useEffect(() => {
    let cancelled = false;
    if (!electionId) return;
    setSeatsLoading(true);
    setSeatsFailedFor(null);
    getConstituencies(electionId)
      .then((list) => { if (!cancelled) setSeats({ electionId, list: [...list].sort((a, b) => a.const_no - b.const_no) }); })
      .catch(() => { if (!cancelled) setSeatsFailedFor(electionId); })
      .finally(() => { if (!cancelled) setSeatsLoading(false); });
    return () => { cancelled = true; };
  }, [electionId, seatsReload]);

  // Default seat: the first by number whenever the current one is not in this election.
  useEffect(() => {
    if (constituencies.length > 0 && !constituencies.some((c) => c.id === selectedConst)) setSelectedConst(constituencies[0].id);
  }, [constituencies, selectedConst]);

  // Only load once the seat belongs to the loaded election; a request counter drops late responses.
  const seatReady = constituencies.some((c) => c.id === selectedConst);
  const requestRef = useRef(0);
  const loadCandidates = useCallback(async () => {
    const req = ++requestRef.current;
    setCandidatesFailed(false);
    if (!electionId || !seatReady) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getCandidates(electionId, selectedConst);
      if (req === requestRef.current) setCandidates(data.filter((c) => !isNota(c)));
    } catch {
      if (req === requestRef.current) { setCandidates([]); setCandidatesFailed(true); }
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, [electionId, selectedConst, seatReady]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const seatsFailed = !!electionId && seatsFailedFor === electionId;
  const error: CandidateLoadError = seatsFailed ? 'seats' : candidatesFailed ? 'candidates' : null;
  /** Reloads the seats when they failed, otherwise the selected seat's candidates. */
  const refresh = useCallback(async () => {
    if (seatsFailed) setSeatsReload((n) => n + 1);
    else await loadCandidates();
  }, [seatsFailed, loadCandidates]);

  const constBaseName = useCallback((constId: string) => {
    const vsMatch = constId.match(/^[A-Z]+_VS\d*_(.+)$/);
    if (vsMatch) return vsMatch[1];
    return constId;
  }, []);

  // Same-name candidates in other elections, for each unlinked candidate (shown in the candidate panel).
  useEffect(() => {
    if (candidates.length === 0) return;
    const unlinked = candidates.filter(c => !c.person_id);
    if (unlinked.length === 0) {
      setLinkingSuggestions(new Map());
      setSelectedMatches(new Map());
      return;
    }

    const suggestions = new Map<string, LinkSuggestion>();
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
        } catch { /* one failed lookup must not stop the others */ }
      }
      if (!cancelled) {
        setLinkingSuggestions(new Map(suggestions));
        // A refresh (e.g. after saving the form) keeps the user's ticks for matches that are still suggested.
        setSelectedMatches((prev) => {
          const next = new Map(preselected);
          suggestions.forEach(({ matches }, candidateId) => {
            const ticked = prev.get(candidateId);
            if (ticked) next.set(candidateId, new Set(matches.filter((m) => ticked.has(m.id)).map((m) => m.id)));
          });
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [candidates, constBaseName]);

  const toggleMatch = (candidateId: string, matchId: string) => {
    setSelectedMatches(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(candidateId) || []);
      if (set.has(matchId)) set.delete(matchId); else set.add(matchId);
      next.set(candidateId, set);
      return next;
    });
  };

  /** Link the candidate and its checked matches to one person (an existing match's, or a new one). */
  const handleLink = async (candidateId: string, matches: Candidate[]): Promise<boolean> => {
    const checked = selectedMatches.get(candidateId);
    const toLink = matches.filter(m => checked?.has(m.id));
    if (toLink.length === 0) { toast('Select at least one match to link', 'error'); return false; }

    try {
      let personId = toLink.find(m => m.person_id)?.person_id ?? undefined;
      if (!personId) {
        const candidate = candidates.find(c => c.id === candidateId);
        const person = await createPerson(candidate?.name || 'Unknown');
        personId = person.id;
      }

      await linkCandidatePerson(candidateId, personId);
      for (const match of toLink) {
        if (!match.person_id) await linkCandidatePerson(match.id, personId);
      }

      toast(`Successfully linked ${toLink.length + 1} records`);
      loadCandidates();
      return true;
    } catch (err) {
      toastError(err, 'Linking failed');
      return false;
    }
  };

  /** New candidate (the backend also adds its zero-vote results row). The caller shows its seat and opens it. */
  const [creating, setCreating] = useState(false);
  const handleCreate = async (data: NewCandidate): Promise<Candidate | null> => {
    setCreating(true);
    try {
      const created = await createCandidate(data);
      toast('Candidate added');
      return created;
    } catch (err) {
      toastError(err, 'Could not add candidate');
      return null;
    } finally {
      setCreating(false);
    }
  };

  const counts = useMemo(() => {
    const linked = candidates.filter((c) => !!c.person_id).length;
    return { all: candidates.length, linked, unlinked: candidates.length - linked };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (personFilter === 'linked' && !c.person_id) return false;
      if (personFilter === 'unlinked' && c.person_id) return false;
      return !q || c.name.toLowerCase().includes(q);
    });
  }, [candidates, personFilter, search]);

  return {
    constituencies, seatsLoading, selectedConst, setSelectedConst,
    personFilter, setPersonFilter, search, setSearch,
    candidates: filteredCandidates, counts, loading, error,
    linkingSuggestions, selectedMatches, toggleMatch, handleLink,
    creating, handleCreate,
    refresh
  };
}
