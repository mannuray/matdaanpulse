import { createContext, useContext, type ReactNode } from 'react';
import type { DashboardSources } from './useDashboardSources';

const SourcesContext = createContext<DashboardSources | null>(null);

export function DashboardSourcesProvider({ value, children }: { value: DashboardSources; children: ReactNode }) {
  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>;
}

export function useSources(): DashboardSources {
  const v = useContext(SourcesContext);
  if (!v) throw new Error('useSources must be used inside DashboardSourcesProvider');
  return v;
}
