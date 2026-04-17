import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Election } from '../types';

interface ElectionContextValue {
  election: Election | null;
  setElection: (e: Election | null) => void;
  electionType: 'LS' | 'VS';
  setElectionType: (t: 'LS' | 'VS') => void;
  selectedStateId: number | null;
  setSelectedStateId: (id: number | null) => void;
  sseConnected: boolean;
  setSseConnected: (v: boolean) => void;
}

const ElectionContext = createContext<ElectionContextValue | undefined>(undefined);

export function ElectionProvider({ children }: { children: ReactNode }) {
  const [election, setElection] = useState<Election | null>(null);
  const [electionType, setElectionType] = useState<'LS' | 'VS'>('LS');
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  return (
    <ElectionContext.Provider value={{ election, setElection, electionType, setElectionType, selectedStateId, setSelectedStateId, sseConnected, setSseConnected }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const context = useContext(ElectionContext);
  if (!context) throw new Error('useElection must be used within ElectionProvider');
  return context;
}
