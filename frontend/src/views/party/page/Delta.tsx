import type { Delta as D } from '../../../viewmodels/pages/usePartyPageVM';
import { signed } from './ui';

/** ▲/▼ seats and points; "—" for seats across a redraw (or with no earlier election). */
export function DeltaCell({ delta, seatsLabel, ptsLabel }: { delta: D | null; seatsLabel: string; ptsLabel: string }) {
  if (!delta) return <span className="text-muted">—</span>;
  const tone = (n: number | null) => (n == null || n === 0 ? 'text-muted' : n > 0 ? 'text-ok-text' : 'text-live-text');
  return (
    <span className="tabular inline-flex flex-wrap items-center gap-x-2 text-xs">
      <span className={tone(delta.seats)}>{delta.seats == null ? '—' : `${delta.seats > 0 ? '▲' : delta.seats < 0 ? '▼' : ''} ${signed(delta.seats)} ${seatsLabel}`}</span>
      <span className={tone(delta.share)}>{signed(delta.share, 1)} {ptsLabel}</span>
    </span>
  );
}
