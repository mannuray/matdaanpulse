import { useMemo } from 'react';
import { useApi } from './useApi';
import { getPartyLineage } from '../../model/api/geo.service';
import { getElections } from '../../model/api/election.service';
import { makeComparer, RAW_COMPARER, type PartyComparer } from '../../model/derive/partyComparer';
import type { LineageEvent } from '../../model/types';

// Lineage changes rarely: fetched once per page load and shared by every comparer.
let lineage: Promise<LineageEvent[]> | null = null;
const loadLineage = () => (lineage ??= getPartyLineage().catch(() => { lineage = null; return []; }));

/**
 * The party comparison rule for one state's elections (renames, mergers, splits): lineage + each election's counting
 * date by year. `stateId` null = national events only (a person's career across states). Plain id equality until loaded.
 */
/** Every lineage event (loaded once), or null while loading. */
export function useLineageEvents(): LineageEvent[] | null {
  return useApi(loadLineage, []).data ?? null;
}

export function usePartyComparer(stateId: number | null | undefined, type: 'LS' | 'VS' = 'VS'): PartyComparer {
  const { data: events } = useApi(loadLineage, []);
  const { data: elections } = useApi(() => (stateId != null ? getElections({ type, state_id: stateId }).catch(() => []) : Promise.resolve([])), [stateId, type]);
  return useMemo(() => {
    if (!events || events.length === 0) return RAW_COMPARER;
    const dates = new Map<number, string>();
    for (const e of elections ?? []) if (e.tentative_next_date) dates.set(e.year, e.tentative_next_date.slice(0, 10));
    return makeComparer(events, dates, stateId ?? null);
  }, [events, elections, stateId]);
}
