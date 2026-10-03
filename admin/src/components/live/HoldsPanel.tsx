import { Button } from '../ui/Button';
import type { HoldRow } from '../../types';

/** Seats an admin correction is holding (spec §5): released by a later round, the timer, or here. */
export function HoldsPanel({ holds, onRelease }: { holds: HoldRow[]; onRelease(constId: string): void }) {
  if (!holds.length) return null;
  return (
    <section aria-label="Seats on hold" className="mx-6 mb-4 rounded-card border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn-text">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide">On hold ({holds.length})</h2>
      <ul className="flex flex-wrap gap-2">
        {holds.map(h => {
          const label = `#${h.const_no} ${h.name}`;
          const mins = Math.max(0, Math.ceil((new Date(h.expires_at).getTime() - Date.now()) / 60_000));
          return (
            <li key={h.const_id} className="flex items-center gap-2 rounded-control border border-warn/40 bg-card px-2.5 py-1 text-ink">
              <span>{label}</span>
              <span className="text-xs text-ink-2">{h.round_at_hold != null ? `round ${h.round_at_hold} · ` : ''}{mins} min left{h.created_by_name ? ` · ${h.created_by_name}` : ''}</span>
              <Button size="sm" variant="ghost" aria-label={`Release ${label}`} onClick={() => onRelease(h.const_id)}>Release</Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
