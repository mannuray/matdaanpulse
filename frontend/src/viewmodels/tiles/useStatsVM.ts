import { useMemo } from 'react';
import { useSources, useLivePulseState } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { deriveStats, rankSeats, flippedSeatRefs, type DashboardStats, type SeatRef } from '../../model/derive/stats';
import type { TickerEvent } from '../../model/live/ticker';

export type { SeatRef, DashboardStats, TickerEvent };

export interface StatsVM {
  stats: DashboardStats;
  closest10: SeatRef[];
  biggest10: SeatRef[];
  flipped: SeatRef[];
  ticker: TickerEvent[];
  isLive: boolean;
  partyColor: Map<string, string>;
  onFocus(): void;
  onSelectSeat(id: string): void;
}

export function useStatsVM(): StatsVM {
  const src = useSources();
  const pulse = useLivePulseState();
  const { dispatch } = useDashboardStore();
  const seats = src.data.mapRegions;
  return {
    stats: useMemo(() => deriveStats(seats, src.totalSeats, src.swing), [seats, src.totalSeats, src.swing]),
    closest10: useMemo(() => rankSeats(seats, 'closest', 10), [seats]),
    biggest10: useMemo(() => rankSeats(seats, 'biggest', 10), [seats]),
    flipped: useMemo(() => flippedSeatRefs(seats, src.swing), [seats, src.swing]),
    ticker: pulse.ticker,
    isLive: src.election.status === 'Live',
    partyColor: src.data.partyColorMap,
    onFocus: () => dispatch({ type: 'focus', tile: 'stats' }),
    onSelectSeat: id => dispatch({ type: 'selectSeat', seat: id }),
  };
}
