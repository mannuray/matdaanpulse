import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Election } from '../../model/types';

interface ElectionContextValue {
  election: Election | null;
  setElection: (e: Election | null) => void;
}

const ElectionContext = createContext<ElectionContextValue | undefined>(undefined);

export function ElectionProvider({ children }: { children: ReactNode }) {
  const [election, setElection] = useState<Election | null>(null);
  const value = useMemo(() => ({ election, setElection }), [election]);
  return <ElectionContext.Provider value={value}>{children}</ElectionContext.Provider>;
}

export function useElection() {
  const context = useContext(ElectionContext);
  if (!context) throw new Error('useElection must be used within ElectionProvider');
  return context;
}
