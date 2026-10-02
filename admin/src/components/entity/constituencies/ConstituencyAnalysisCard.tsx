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

/**
 * Constituency record, right column: what `constituency_analysis` holds for this seat and election (dominance,
 * incumbency, notes) and when it was computed, or "Not computed yet".
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
  const inc = analysis.incumbency ?? {};
  const computed = analysis.updated_at ? formatIstDate(analysis.updated_at) : '';
  const incumbent = inc.incumbent_name ? `${inc.incumbent_name}${inc.incumbent_party ? ` (${inc.incumbent_party})` : ''}` : null;
  return (
    <RecordCard title="Analysis" subtitle={computed ? `Computed ${computed}` : undefined}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-xs">
        <Row label="Dominance">
          {analysis.dominance
            ? <Badge tone="muted">{sentence(analysis.dominance)}{analysis.dominance_party ? ` · ${analysis.dominance_party}` : ''}</Badge>
            : '—'}
        </Row>
        <Row label="Incumbent">{incumbent ?? '—'}</Row>
        {typeof inc.re_contesting === 'boolean' && <Row label="Re-contesting">{inc.re_contesting ? 'Yes' : 'No'}</Row>}
        {inc.switched_to && <Row label="Switched to">{inc.switched_to}</Row>}
      </dl>
      {analysis.notes && <p className="mt-3 border-t border-line pt-3 text-xs whitespace-pre-line text-ink-2">{analysis.notes}</p>}
    </RecordCard>
  );
}
