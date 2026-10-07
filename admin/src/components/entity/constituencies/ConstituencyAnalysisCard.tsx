import type { ReactNode } from 'react';
import { RecordCard } from '../../record/RecordCard';
import { Badge } from '../../ui/Badge';
import { formatIstDate } from '../../../utils/time';
import type { ConstituencyAnalysis } from '../../../types';

/** 'stronghold' → 'Stronghold' (the stored value is unchanged). */
const sentence = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </>
  );
}

/** 'gained' from RJD → 'Gained from RJD'; 'new' → 'New'. */
function outcomeText(o: { kind: string; from: string | null }): string {
  const label = sentence(o.kind);
  return o.from && (o.kind === 'gained' || o.kind === 'split') ? `${label} from ${o.from}` : label;
}

/**
 * Constituency record, right column: what `constituency_analysis` holds for this seat and election (class,
 * outcome, incumbency, notes) and when it was computed, or "Not computed yet".
 */
export function ConstituencyAnalysisCard({ analysis }: { analysis: ConstituencyAnalysis | null | undefined }) {
  if (!analysis) {
    return (
      <RecordCard title="Analysis">
        <p className="text-sm text-ink-2">Not computed yet</p>
        <p className="mt-1 text-xs text-muted">Use "Compute all analysis" on the Constituencies list.</p>
      </RecordCard>
    );
  }
  const d = analysis.data ?? {};
  const computedAt = analysis.computed_at ?? analysis.updated_at;
  const computed = computedAt ? formatIstDate(computedAt) : '';
  const inc = d.incumbent;
  const incumbent = inc ? `${inc.name}${inc.party ? ` (${inc.party})` : ''}` : null;
  const cls = d.class ? `${sentence(d.class.kind)} · ${d.class.holder} since ${d.class.since}` : null;
  const outcome = d.outcome ? outcomeText(d.outcome) : null;
  return (
    <RecordCard title="Analysis" subtitle={computed ? `Computed ${computed}` : undefined}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-xs">
        <Row label="Class">{cls ? <Badge tone="muted">{cls}</Badge> : '—'}</Row>
        <Row label="Outcome">{outcome ?? '—'}</Row>
        <Row label="Incumbent">{incumbent ?? '—'}</Row>
        {inc && <Row label="Re-contesting">{inc.recontested ? 'Yes' : 'No'}</Row>}
        {inc?.switched && inc.party_now && <Row label="Switched to">{inc.party_now}</Row>}
      </dl>
      {analysis.notes && <p className="mt-3 border-t border-line pt-3 text-xs whitespace-pre-line text-ink-2">{analysis.notes}</p>}
    </RecordCard>
  );
}
