import { createContext, useContext, type ReactNode } from 'react';
import type { DashboardSources } from './useDashboardSources';
import type { LivePulse } from './useLivePulse';

const SourcesContext = createContext<DashboardSources | null>(null);
const NO_PULSE: LivePulse = { ticker: [], recentSeats: new Map() };
/** Separate from the sources: the pulse changes every few seconds while counting, the sources only with new data. */
const PulseContext = createContext<LivePulse>(NO_PULSE);

export function DashboardSourcesProvider({ value, children }: { value: DashboardSources; children: ReactNode }) {
  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>;
}

export function LivePulseProvider({ value, children }: { value: LivePulse; children: ReactNode }) {
  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}

export function useSources(): DashboardSources {
  const v = useContext(SourcesContext);
  if (!v) throw new Error('useSources must be used inside DashboardSourcesProvider');
  return v;
}

/** The live pulse and ticker (empty outside a LivePulseProvider). */
export function useLivePulseState(): LivePulse {
  return useContext(PulseContext);
}
