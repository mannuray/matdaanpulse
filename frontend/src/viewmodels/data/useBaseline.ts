import { useApi } from './useApi';
import { getBaseline } from '../../model/api/api';
import type { Baseline } from '../../model/derive/seatAnalysis';

/** The election's pre-counting baseline (Upcoming / Live only); null when missing or not wanted. */
export function useBaseline(electionId: string | undefined, enabled: boolean): Baseline | null {
  const { data } = useApi(() => (electionId && enabled ? getBaseline(electionId) : Promise.resolve(null)), [electionId, enabled]);
  return data ?? null;
}
