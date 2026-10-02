import { RecordCard } from '../../record/RecordCard';
import { RecordLink } from '../../record/RecordLink';
import { Badge, type Tone } from '../../ui/Badge';
import { cn } from '../../ui/cn';
import { shortElectionName } from '../../shell/ElectionPicker';
import type { PersonCandidate } from '../../../types';

/** Readable results.status for an election still counting; an unknown value shows as stored. */
const LIVE_STATUS: Record<string, string> = { LEADING: 'Leading', TRAILING: 'Trailing', PENDING: 'Pending', LOST: 'Lost' };

/**
 * The outcome badge of a contest (Decision 7): `WON` → Won; any other status once the election is Finalized → Lost;
 * otherwise the status itself (sentence case for the known ones). No badge when there is no result row.
 */
export function contestOutcome(c: Pick<PersonCandidate, 'status' | 'election_status'>): { label: string; tone: Tone } | null {
  if (c.status === 'WON') return { label: 'Won', tone: 'ok' };
  if (!c.status) return null; // no result row: nothing to call a loss, even when the election is Finalized
  if (c.election_status === 'Finalized') return { label: 'Lost', tone: 'muted' };
  return { label: LIVE_STATUS[c.status] ?? c.status, tone: c.status === 'LEADING' ? 'accent' : 'muted' };
}

const electionLabel = (c: PersonCandidate) =>
  c.election_name && c.election_type && c.election_year
    ? shortElectionName(c.election_name, c.election_type, c.election_year)
    : c.election_name || c.election_id;

const seatLabel = (c: PersonCandidate) => {
  const name = c.constituency_name || c.const_id;
  return c.const_no != null ? `${c.const_no} ${name}` : name;
};

/** Person record, right column: every contest, newest first, each row opening the candidate in its election. */
export function PersonHistoryCard({ contests }: { contests: PersonCandidate[] }) {
  return (
    <RecordCard title="Election history" action={<Badge tone="muted" className="font-mono">{contests.length} recorded</Badge>}>
      {contests.length === 0 ? (
        <p className="text-xs text-muted">No contests recorded.</p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
          {contests.map((c) => {
            const outcome = contestOutcome(c);
            return (
              <li key={c.id} className="relative pl-6">
                <span
                  aria-hidden
                  className={cn('absolute top-4 left-0 h-[11px] w-[11px] rounded-full border-2 border-card', outcome?.label === 'Won' ? 'bg-ok' : 'bg-muted')}
                />
                <RecordLink
                  to={`/candidates/${c.id}`}
                  electionId={c.election_id}
                  className="block rounded-control border border-line px-3.5 py-3 hover:border-accent/50 hover:bg-subtle"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-ink" title={c.election_name ?? undefined}>{electionLabel(c)}</span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
                      {outcome && <Badge tone={outcome.tone}>{outcome.label}</Badge>}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-2">
                    <span className="min-w-0 truncate">{seatLabel(c)}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5" title={c.party_name ?? undefined}>
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c.party_color || 'var(--color-muted)' }} />
                      {c.party_id || 'IND'}
                    </span>
                  </div>
                </RecordLink>
              </li>
            );
          })}
        </ol>
      )}
    </RecordCard>
  );
}
