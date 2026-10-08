import { useCallback, useEffect, useMemo, useState } from 'react';
import { seatStatus } from '../../utils/seat-math';
import type { LiveConstituency } from '../../types';

export type SeatFilter = 'all' | 'PENDING' | 'LEADING' | 'WON';

/** The Live Console list: filter, search, sort, and a selection kept valid (held while the editor has unsaved edits). */
export function useSeatSelection(all: LiveConstituency[], holdSelection: boolean, resetKey?: string) {
  const [filter, setFilter] = useState<SeatFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setSelectedId(null); }, [resetKey]);

  const seats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((c) => filter === 'all' || seatStatus(c) === filter)
      .filter((c) => !q || String(c.const_no).startsWith(q) || c.const_name.toLowerCase().includes(q))
      .sort((a, b) => a.const_no - b.const_no);
  }, [all, filter, search]);

  // Keep a valid selection inside the visible list.
  useEffect(() => {
    if (holdSelection && selectedId && all.some((s) => s.const_id === selectedId)) return; // unsaved edits: keep the seat
    if (seats.length === 0) { if (selectedId !== null) setSelectedId(null); return; }
    if (!selectedId || !seats.some((s) => s.const_id === selectedId)) setSelectedId(seats[0].const_id);
  }, [seats, selectedId, holdSelection, all]);

  const move = useCallback((delta: 1 | -1) => {
    setSelectedId((cur) => {
      const i = seats.findIndex((s) => s.const_id === cur);
      const next = seats[Math.min(seats.length - 1, Math.max(0, i + delta))];
      return next ? next.const_id : cur;
    });
  }, [seats]);

  return { filter, setFilter, search, setSearch, seats, selectedId, select: setSelectedId, move };
}
