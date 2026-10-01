import { RecordCard } from '../../record/RecordCard';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { formatMargin } from '../../../utils/numbers';
import type { ConstituencyHistory } from '../../../types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Party changed 2 times in 4 elections" (Decision 7; replaces the design's "Voter elasticity"). */
export const volatilityLine = (v: ConstituencyHistory['volatility']) =>
  `Party changed ${plural(v.changes, 'time', 'times')} in ${plural(v.elections, 'election', 'elections')}`;

/** 58.4 → "58.4%"; null → null. */
export const formatTurnout = (v: number | string | null | undefined): string | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v))
    ? null
    : `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

interface ConstituencyHistoryCardProps {
  seatName: string;
  history: ConstituencyHistory | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

/**
 * Constituency record, right column: the winner of this seat in each election of the same type (from results, so it
 * does not need "Compute analysis"), newest first, with this election marked.
 */
export function ConstituencyHistoryCard({ seatName, history, loading, failed, onRetry }: ConstituencyHistoryCardProps) {
  const rows = history?.rows ?? [];
  const earlier = rows.some((r) => !r.is_current);
  return (
    <RecordCard title="Seat history" subtitle={`Past election outcomes in ${seatName}`}>
      {loading ? (
        <p className="text-xs text-muted">Loading seat history…</p>
      ) : failed && !history ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-bad-text">Could not load seat history</span>
          <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
        </div>
      ) : (
        <>
          {earlier && history && <p className="mb-2 text-xs text-ink-2">{volatilityLine(history.volatility)}</p>}
          {rows.length > 0 && (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const turnout = formatTurnout(r.turnout);
                return (
                  <li
                    key={r.election_id}
                    className={cn('flex items-start gap-3 py-2.5 text-sm', r.is_current && '-mx-2 rounded-control bg-accent-soft/50 px-2')}
                  >
                    <span className="w-10 shrink-0 pt-0.5 font-mono text-xs font-semibold text-ink">{r.year}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={r.party_id ? 'ok' : 'muted'}>{r.party_id ?? 'No result'}</Badge>
                        {r.is_current && <Badge tone="accent">This election</Badge>}
                      </div>
                      <div className="mt-1 truncate text-ink">{r.winner ?? '—'}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cn('text-sm font-medium tabular-nums', r.margin && r.margin > 0 ? 'text-ok-text' : 'text-ink-2')}>{formatMargin(r.margin)}</div>
                      <div className="text-[11px] text-muted">{turnout ? `margin · ${turnout} turnout` : 'margin'}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!earlier && <p className={cn('text-xs text-muted', rows.length > 0 && 'mt-2')}>No earlier elections for this seat</p>}
        </>
      )}
    </RecordCard>
  );
}
