import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useApi } from '../data/useApi';
import { getElections, getManifest, getRegionShares } from '../../model/api/election.service';
import { redrawnTo } from '../../model/derive/delimitation';
import { compareRegions, type Alliance, type RegionRow } from '../../model/derive/regionComparison';

export interface RegionComparisonVM {
  prevYear: number;
  curYear: number;
  rows: RegionRow[];
}

/**
 * Statewide + per-region comparison with the state's previous election, only for an election whose boundaries were
 * redrawn since (seat-by-seat history does not apply there). Null otherwise, and while loading.
 */
export function useRegionComparisonVM(): RegionComparisonVM | null {
  const src = useSources();
  const election = src.election;
  const list = useApi(() => getElections({ type: election.type, state_id: election.state_id ?? undefined }).catch(() => []), [election.id], { key: `elections_${election.type}_${election.state_id}` });
  const prev = useMemo(() => {
    const all = list.data ?? [];
    if (!redrawnTo(election, all)) return null;
    return all.filter(e => e.type === election.type && e.state_id === election.state_id && e.year < election.year).sort((a, b) => b.year - a.year)[0] ?? null;
  }, [list.data, election]);
  const cur = useApi(() => (prev ? getRegionShares(election.id) : Promise.resolve(null)), [election.id, prev?.id]);
  const old = useApi(() => (prev ? getRegionShares(prev.id) : Promise.resolve(null)), [prev?.id]);
  const oldManifest = useApi(() => (prev ? getManifest(prev.id).catch(() => null) : Promise.resolve(null)), [prev?.id]);
  const curAlliances = useMemo(() => (src.data.manifestData?.alliances ?? []) as Alliance[], [src.data.manifestData]);
  return useMemo(() => {
    if (!prev || !cur.data || !old.data) return null;
    const prevAlliances = (oldManifest.data?.draft?.alliances ?? []) as Alliance[];
    return { prevYear: prev.year, curYear: election.year, rows: compareRegions(cur.data, old.data, curAlliances, prevAlliances) };
  }, [prev, cur.data, old.data, oldManifest.data, curAlliances, election.year]);
}
