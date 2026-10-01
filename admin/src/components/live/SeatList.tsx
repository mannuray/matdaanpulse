import { forwardRef, useEffect, useRef } from 'react';
import { Lock, Search } from 'lucide-react';
import { Badge, StatusPill } from '../ui/Badge';
import { cn } from '../ui/cn';
import { rankSeat, seatStatus, type SeatRow } from '../../utils/seat-math';
import type { LiveConstituency, SeatLock } from '../../types';
import type { SeatFilter } from '../../hooks/useLiveConsole';

interface Props {
  seats: LiveConstituency[];
  counts: { all: number; PENDING: number; LEADING: number; WON: number };
  filter: SeatFilter; onFilter(f: SeatFilter): void;
  search: string; onSearch(s: string): void;
  selectedId: string | null; onSelect(id: string): void;
  locks: Record<string, SeatLock>; myUserId: string;
  flashIds: Set<string>;
}

const CHIPS: { key: SeatFilter; label: string; on: string; off: string }[] = [
  { key: 'all', label: 'All', on: 'bg-accent text-white', off: 'bg-subtle text-ink-2' },
  { key: 'PENDING', label: 'Pending', on: 'bg-ink-2 text-white', off: 'bg-subtle text-ink-2' },
  { key: 'LEADING', label: 'Leading', on: 'bg-accent text-white', off: 'bg-accent-soft text-accent' },
  { key: 'WON', label: 'Won', on: 'bg-ok text-white', off: 'bg-ok-soft text-ok-text' },
];

function leaderOf(c: LiveConstituency) {
  const rows = c.candidates.map((x) => ({ ...x, status: x.status })) as unknown as SeatRow[];
  return rankSeat(rows).leader;
}

export const SeatList = forwardRef<HTMLInputElement, Props>(function SeatList(p, searchRef) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [p.selectedId]);

  return (
    <section className="flex w-80 shrink-0 flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm">
      <div className="space-y-2.5 border-b border-line p-3">
        <label className="relative block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={searchRef}
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Jump to seat…"
            aria-label="Jump to seat"
            className="h-8 w-full rounded-control border border-line bg-card pl-8 pr-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter seats">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={p.filter === c.key}
              onClick={() => p.onFilter(c.key)}
              className={cn('rounded-control px-2 py-1 text-xs font-medium whitespace-nowrap', p.filter === c.key ? c.on : c.off)}
            >
              {c.label} <span className="tabular-nums">{c.key === 'all' ? p.counts.all : p.counts[c.key]}</span>
            </button>
          ))}
        </div>
      </div>
      <div ref={listRef} role="listbox" aria-label="Seats" className="flex-1 divide-y divide-line overflow-y-auto">
        {p.seats.length === 0 && <p className="p-6 text-center text-sm text-muted">No seats match.</p>}
        {p.seats.map((s) => {
          const selected = s.const_id === p.selectedId;
          const status = seatStatus(s);
          const leader = status === 'PENDING' ? null : leaderOf(s);
          const lock = p.locks[s.const_id];
          const lockedByOther = lock && lock.user_id !== p.myUserId;
          return (
            <div
              key={s.const_id}
              role="option"
              aria-selected={selected}
              onClick={() => p.onSelect(s.const_id)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 border-l-4 px-3 py-2.5 transition-colors',
                selected ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-subtle',
                p.flashIds.has(s.const_id) && 'bg-warn-soft',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-7 font-mono text-xs text-muted">{s.const_no}</span>
                <span className={cn('truncate text-xs', selected ? 'font-semibold text-ink' : 'font-medium text-ink')}>{s.const_name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {lockedByOther ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted"><Lock size={12} aria-hidden />{lock.user_name}</span>
                ) : leader ? (
                  <Badge className="border border-line bg-card" style={{ color: leader.party_color ?? undefined }}>{leader.party_abbr ?? leader.party_id}</Badge>
                ) : null}
                <StatusPill status={status} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
