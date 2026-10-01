import type { ReactNode } from 'react';
import { RecordCard } from '../../record/RecordCard';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { formatMargin, ordinal } from '../../../utils/numbers';
import { resultStatus } from './resultStatus';
import type { CandidateResult } from '../../../types';

/** No votes to show: the seat has none recorded (TN 2021 has margins only, or counting has not started), or this candidate has none. */
export const noVoteCounts = (r: CandidateResult) => !r.candidate || r.candidate.votes === null || r.total_votes === 0;

function Tile({ label, value, sub, highlight, children }: { label: string; value: ReactNode; sub?: ReactNode; highlight?: boolean; children?: ReactNode }) {
  return (
    <div className={cn('min-w-0 rounded-card border p-4', highlight ? 'border-ok/40 bg-ok-soft' : 'border-line')}>
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {children}
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

interface CandidateResultCardProps {
  result: CandidateResult | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

/**
 * Candidate record, read only (Decision 7): votes, vote share with a bar, position with the status badge, and margin,
 * all from GET /admin/candidates/:id/result. The share comes from the backend (null when the seat has no votes), so a
 * seat without counts never divides by zero; it says "No vote counts recorded" instead.
 */
export function CandidateResultCard({ result, loading, failed, onRetry }: CandidateResultCardProps) {
  const declared = !!result?.declared;
  const row = result?.candidate ?? null;
  const status = resultStatus(row?.status);
  const leads = !!row && row.position === 1 && (row.margin ?? 0) >= 0;
  return (
    <RecordCard
      title="Result"
      subtitle={result ? (declared ? 'Counting finalised' : 'Counting not finalised') : undefined}
      action={declared ? <Badge tone="ok">Result declared</Badge> : undefined}
    >
      {failed ? (
        <div className="flex items-center justify-between gap-3 text-sm text-ink-2">
          <span>Could not load the result.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
        </div>
      ) : loading || !result ? (
        <p className="text-sm text-muted">Loading result…</p>
      ) : noVoteCounts(result) ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">No vote counts recorded</p>
          {row && (status || row.margin !== null) && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {status && <Badge tone={status.tone}>{status.label}</Badge>}
              {row.margin !== null && <span>Margin {formatMargin(row.margin)}</span>}
            </p>
          )}
        </div>
      ) : row && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Tile label="Votes" value={(row.votes ?? 0).toLocaleString('en-IN')} sub={`of ${result.total_votes.toLocaleString('en-IN')} in the seat`} />
          <Tile label="Vote share" value={row.share === null ? '—' : `${row.share.toFixed(1)}%`}>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, row.share ?? 0))}%` }} />
            </div>
          </Tile>
          <Tile
            label="Position"
            highlight={row.status === 'WON'}
            value={<>{row.position === null ? '—' : ordinal(row.position)}{status && <Badge tone={status.tone}>{status.label}</Badge>}</>}
          />
          <Tile
            label="Margin"
            value={<span className={cn(leads && row.margin ? 'text-accent' : undefined)}>{formatMargin(row.margin)}</span>}
            sub={row.margin === null ? undefined : leads ? 'Lead over the runner-up' : 'Behind the winner'}
          />
        </div>
      )}
    </RecordCard>
  );
}
