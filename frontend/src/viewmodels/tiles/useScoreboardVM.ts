import { useMemo } from 'react';
import { useSources, useLivePulseState } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveScoreboard, type Scoreboard, type ScoreBloc } from '../../model/derive/scoreboard';
import { intentFor } from '../store/hoverIntent';
import { useThemedColor } from '../theme/useThemedColor';
import { deriveStandingRows, type StandingRow } from '../../model/derive/standings';
import { countDeclared } from '../../model/derive/marginStats';

export type { Scoreboard, ScoreBloc };

/** Short display label: alliance id when the name is long, else the name; party id for parties. */
const shortLabel = (b: ScoreBloc) => b.kind === 'party' ? b.id : b.name.length > 12 ? b.id : b.name;

/** `textColor` is `color` adjusted to 4.5:1 for small text in light theme (`color` itself is the 3:1 fill colour). */
export type ScoreBlocVM = ScoreBloc & { label: string; textColor: string };

export interface ScoreboardVM extends Omit<Scoreboard, 'blocs'> {
  blocs: ScoreBlocVM[];
  status: 'final' | 'live' | 'upcoming';
  /** Seats declared so far (the phone's status pill). */
  declared: number;
  /** Pulse the tile once when live results changed a seat. */
  pulse: boolean;
  /** Member parties per bloc, for the expanded view. */
  breakdown: { id: string; name: string; color: string; textColor: string; rows: StandingRow[] }[];
  lockedId: string | null;
  onFocus(): void;
  onHoverBloc(id: string | null): void;
  onLockBloc(id: string): void;
}

export function useScoreboardVM(): ScoreboardVM {
  const src = useSources();
  const pulse = useLivePulseState();
  const { state, dispatch } = useDashboardStore();
  const themed = useThemedColor();
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const board = useMemo(
    () => deriveScoreboard(alliances, src.data.mapPartyList, src.votePct, src.totalSeats, src.majority),
    [alliances, src.data.mapPartyList, src.votePct, src.totalSeats, src.majority],
  );
  const partiesOf = (id: string) => alliances.find(a => a.id === id)?.parties ?? [id];
  const declared = useMemo(() => countDeclared(src.data.mapRegions), [src.data.mapRegions]);
  const status = src.election.status === 'Live' ? 'live' : src.election.status === 'Finalized' ? 'final' : 'upcoming';
  const breakdown = useMemo(() => {
    const rows = deriveStandingRows(src.data.mapPartyList, src.votePct, alliances, { includeZero: true });
    return board.blocs.map(b => ({ id: b.id, name: b.name, color: b.color, textColor: themed.color(b.color, 'text'), rows: b.kind === 'alliance' ? rows.filter(r => r.allianceId === b.id) : rows.filter(r => r.id === b.id) }));
  }, [board.blocs, src.data.mapPartyList, src.votePct, alliances, themed]);
  return {
    ...board,
    blocs: board.blocs.map(b => ({ ...b, label: shortLabel(b), textColor: themed.color(b.color, 'text') })),
    status,
    declared,
    pulse: pulse.recentSeats.size > 0,
    breakdown,
    lockedId: state.locked?.chipId.startsWith('bloc:') ? state.locked.chipId.slice(5) : null,
    onFocus: () => dispatch({ type: 'focus', tile: 'scoreboard' }),
    onHoverBloc: id => intentFor(dispatch)(id ? { parties: partiesOf(id), seats: [] } : null),
    onLockBloc: id => {
      const b = board.blocs.find(x => x.id === id);
      dispatch({ type: 'toggleLock', chipId: `bloc:${id}`, highlight: { parties: partiesOf(id), seats: [] }, label: b ? shortLabel(b) : id });
    },
  };
}
