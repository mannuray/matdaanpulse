import { useMemo } from 'react';
import { useSources, useLivePulseState } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { intentFor } from '../store/hoverIntent';
import { deriveStandingRows, type StandingRow } from '../../model/derive/standings';

export type { StandingRow };

export interface StandingsVM {
  rows: StandingRow[];
  allRows: StandingRow[];
  pulse: boolean;
  lockedId: string | null;
  onFocus(): void;
  onHoverParty(id: string | null): void;
  onLockParty(id: string): void;
  markOf(partyId: string): string | null;
  onOpenParty(partyId: string): void;
}

export function useStandingsVM(): StandingsVM {
  const src = useSources();
  const pulse = useLivePulseState();
  const { state, dispatch } = useDashboardStore();
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const rows = useMemo(() => deriveStandingRows(src.data.mapPartyList, src.votePct, alliances), [src.data.mapPartyList, src.votePct, alliances]);
  const allRows = useMemo(() => deriveStandingRows(src.data.mapPartyList, src.votePct, alliances, { includeZero: true }), [src.data.mapPartyList, src.votePct, alliances]);
  return {
    rows,
    allRows,
    pulse: pulse.recentSeats.size > 0,
    lockedId: state.locked?.chipId.startsWith('party:') ? state.locked.chipId.slice(6) : null,
    onFocus: () => dispatch({ type: 'focus', tile: 'standings' }),
    onHoverParty: id => intentFor(dispatch)(id ? { parties: [id], seats: [] } : null),
    onLockParty: id => dispatch({ type: 'toggleLock', chipId: `party:${id}`, highlight: { parties: [id], seats: [] }, label: id }),
    markOf: id => src.partyMeta.get(id)?.mark ?? null,
    onOpenParty: id => dispatch({ type: 'selectParty', party: id }),
  };
}
