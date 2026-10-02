import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getCandidates, createCandidate, type CandidateAffidavit } from '../services/candidate.service';
import { getConstituencies } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import type { Candidate, Constituency } from '../types';

/** Which load failed: the election's seats, or the selected seat's candidates. */
export type CandidateLoadError = 'seats' | 'candidates' | null;
/** Body of POST /admin/candidates (backend CreateCandidateDto). No person_id: the backend creates the person from the ballot name. */
export interface NewCandidate extends CandidateAffidavit { election_id: string; const_id: string; name: string; party_id: string }

const isNota = (c: Candidate) => c.party_id === 'NOTA' || c.name === 'NOTA';

/**
 * CONTROLLER: Candidate Manager (MVC)
 * Candidates of one seat in the global election and a name search. Every candidate has a person (migration 018).
 * Cross-election candidate search lives in the ⌘K palette.
 */
export function useCandidateManager(electionId: string, initialSeat = '') {
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

  // `initialSeat` (the page's ?seat=) is only a starting point: the default-seat effect replaces it when it is not a
  // seat of this election.
  const [selectedConst, setSelectedConst] = useState(initialSeat);
  const [search, setSearch] = useState('');

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

  const counts = useMemo(() => ({ all: candidates.length }), [candidates]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;
  }, [candidates, search]);

  return {
    constituencies, seatsLoading, selectedConst, setSelectedConst,
    search, setSearch,
    candidates: filteredCandidates, counts, loading, error,
    creating, handleCreate,
    refresh
  };
}
