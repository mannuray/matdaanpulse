import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getElections } from '../services/election.service';
import type { Election } from '../types';

export const ELECTION_STORAGE_KEY = 'mp.admin.election';

interface ElectionContextValue {
  elections: Election[];
  electionId: string;
  election: Election | null;
  setElectionId: (id: string) => void;
  loading: boolean;
  error: string | null;
  /** Re-fetch after create / go live / finalize; keeps the selection while it still exists. */
  reload: () => Promise<void>;
}

const Ctx = createContext<ElectionContextValue | null>(null);

function readStorage(): string | null {
  try { return localStorage.getItem(ELECTION_STORAGE_KEY); } catch { return null; }
}
function writeStorage(id: string) {
  try { localStorage.setItem(ELECTION_STORAGE_KEY, id); } catch { /* private mode */ }
}

export function pickInitialElection(elections: Election[], fromUrl: string | null, fromStorage: string | null): string {
  const has = (id: string | null): id is string => !!id && elections.some((e) => e.id === id);
  if (has(fromUrl)) return fromUrl;
  if (has(fromStorage)) return fromStorage;
  return elections.find((e) => e.status === 'Live')?.id ?? elections[0]?.id ?? '';
}

/** One election selection shared by every page (top-bar picker), synced to ?election= and localStorage. */
export function ElectionProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getElections()
      .then((all) => {
        if (cancelled) return;
        setElections(all);
        setId(pickInitialElection(all, params.get('election'), readStorage()));
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load elections');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // load once; URL changes go through setElectionId
  }, []);

  const setElectionId = useCallback((id: string) => {
    setId(id);
    writeStorage(id);
    setParams((prev) => { const next = new URLSearchParams(prev); next.set('election', id); return next; }, { replace: true });
  }, [setParams]);

  const reload = useCallback(async () => {
    try {
      const all = await getElections();
      setElections(all);
      setId((cur) => (cur && all.some((e) => e.id === cur) ? cur : pickInitialElection(all, null, readStorage())));
      setError(null);
    } catch {
      setError('Could not load elections');
    }
  }, []);

  const value = useMemo<ElectionContextValue>(() => ({
    elections, electionId, setElectionId, loading, error, reload,
    election: elections.find((e) => e.id === electionId) ?? null,
  }), [elections, electionId, setElectionId, loading, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useElection(): ElectionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useElection must be used inside <ElectionProvider>');
  return v;
}
