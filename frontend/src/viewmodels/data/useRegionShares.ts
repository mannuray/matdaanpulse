import { useApi } from './useApi';
import { getRegionShares } from '../../model/api/election.service';
import type { RegionShares } from '../../model/derive/regionComparison';

/** An election's region shares (null while loading, on error, or when `enabled` is false). One request per election. */
export function useRegionShares(electionId: string | null, enabled = true): RegionShares | null {
  const on = enabled && !!electionId;
  const { data } = useApi(() => (on ? getRegionShares(electionId!).catch(() => null) : Promise.resolve(null)), [electionId, on],
    { key: on ? `region_shares_${electionId}` : undefined });
  return data ?? null;
}
