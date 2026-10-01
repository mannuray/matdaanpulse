import { ArrowRight } from 'lucide-react';
import { RecordCard } from '../../record/RecordCard';
import { RecordLink } from '../../record/RecordLink';
import { Button } from '../../ui/Button';
import { shortElectionName } from '../../shell/ElectionPicker';
import type { usePartyUsage } from '../../../hooks/usePartyUsage';

const n = (v: number) => v.toLocaleString('en-IN');
const plural = (v: number, one: string, many: string) => `${n(v)} ${v === 1 ? one : many}`;

/** "1,204 candidates · 9 elections" (the record header meta; the card adds wins). */
export const usageSummary = (t: { candidates: number; elections: number }) =>
  `${plural(t.candidates, 'candidate', 'candidates')} · ${plural(t.elections, 'election', 'elections')}`;

/** Party record, right column: candidates and wins per election, each row opening that election's candidates. */
export function PartyUsageCard({ state }: { state: ReturnType<typeof usePartyUsage> }) {
  const { usage, loading, failed, retry } = state;
  return (
    <RecordCard title="Usage" subtitle="Candidates fielded in each election">
      {loading ? (
        <p className="text-xs text-muted">Loading usage…</p>
      ) : failed || !usage ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-bad-text">Could not load usage</span>
          <Button size="sm" variant="outline" onClick={retry}>Try again</Button>
        </div>
      ) : usage.elections.length === 0 ? (
        <p className="text-xs text-muted">Not used in any election yet</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-2">{usageSummary(usage.totals)} · {n(usage.totals.wins)} won</p>
          <ul className="divide-y divide-line">
            {usage.elections.map((e) => (
              <li key={e.election_id}>
                <RecordLink
                  to="/candidates"
                  electionId={e.election_id}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm hover:text-accent"
                >
                  <span className="min-w-0 truncate text-ink" title={e.name}>{shortElectionName(e.name, e.type, e.year)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {plural(e.candidates, 'candidate', 'candidates')} · {n(e.wins)} won
                  </span>
                </RecordLink>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 border-t border-line pt-3">
        {/* The Candidates page has no party filter yet, so this opens it as is. */}
        <RecordLink to="/candidates" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          View candidates <ArrowRight size={12} aria-hidden />
        </RecordLink>
      </div>
    </RecordCard>
  );
}
