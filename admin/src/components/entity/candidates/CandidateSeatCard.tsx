import { RecordCard } from '../../record/RecordCard';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { resultStatus } from './resultStatus';
import type { CandidateResult, SeatRow } from '../../../types';

interface CandidateSeatCardProps {
  candidateId: string;
  /** "176 Harnaut". */
  seatLabel: string;
  seatName: string;
  result: CandidateResult | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** A row of another candidate: open its record (the page applies the unsaved guard). */
  onOpen: (candidateId: string) => void;
}

const isNota = (r: SeatRow) => r.party_id === 'NOTA';

function RowBody({ r, showVotes }: { r: SeatRow; showVotes: boolean }) {
  const status = resultStatus(r.status);
  return (
    <>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{r.position !== null ? `${r.position}. ` : ''}{r.name}</span>
          {status && !isNota(r) && <span className={cn('shrink-0 text-[11px]', r.status === 'WON' ? 'font-medium text-ok-text' : 'text-muted')}>{status.label}</span>}
        </div>
        <div className="text-xs text-muted">{isNota(r) ? 'None of the above' : r.party_id || 'IND'}</div>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <div className="text-sm text-ink">{showVotes && r.votes !== null ? r.votes.toLocaleString('en-IN') : '—'}</div>
        <div className="text-[11px] text-muted">{r.share === null ? '—' : `${r.share.toFixed(1)}%`}</div>
      </div>
    </>
  );
}

/**
 * Candidate record, right column: every candidate of the seat (rank, name, party, votes, share), NOTA last, with this
 * candidate highlighted. With no votes recorded the names are still listed. A row opens that candidate's record.
 */
export function CandidateSeatCard({ candidateId, seatLabel, seatName, result, loading, failed, onRetry, onOpen }: CandidateSeatCardProps) {
  const rows = result?.seat ?? [];
  const count = rows.filter((r) => !isNota(r)).length;
  const showVotes = !!result && result.total_votes > 0;
  return (
    <RecordCard
      title={`Other candidates in ${seatName}`}
      subtitle={result ? `${seatLabel} · ${count} ${count === 1 ? 'candidate' : 'candidates'}` : seatLabel}
    >
      {failed ? (
        <div className="flex items-center justify-between gap-3 text-sm text-ink-2">
          <span>Could not load the seat.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
        </div>
      ) : loading || !result ? (
        <p className="text-sm text-muted">Loading candidates…</p>
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {rows.map((r) => {
            const current = r.candidate_id === candidateId;
            const cls = 'flex w-full items-center justify-between gap-3 rounded-control px-2 py-2.5 text-left';
            return (
              <li key={r.candidate_id}>
                {current ? (
                  <div aria-current="true" className={cn(cls, 'border border-accent/30 bg-accent-soft/60')}><RowBody r={r} showVotes={showVotes} /></div>
                ) : (
                  <button type="button" className={cn(cls, 'hover:bg-subtle')} onClick={() => onOpen(r.candidate_id)}>
                    <RowBody r={r} showVotes={showVotes} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </RecordCard>
  );
}
