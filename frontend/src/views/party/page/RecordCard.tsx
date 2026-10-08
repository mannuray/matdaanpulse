import { useTranslation } from 'react-i18next';
import type { PartyStateView } from '../../../viewmodels/pages/usePartyPageVM';
import { DeltaCell } from './Delta';
import { RecordChart } from './RecordChart';
import { fmtShare, heading, tile } from './ui';

/** The state's election record, newest first: lineage events inline, a divider where the boundaries changed. */
export function RecordCard({ sv, color, nameOf }: { sv: PartyStateView; color: string; nameOf(id: string): string }) {
  const { t } = useTranslation();
  const seats = t('pty_seats_short'), pts = t('pty_pts');
  return (
    <section id="pty-record" className={`${tile} scroll-mt-28 p-4`} aria-label={t('pty_record')}>
      <h2 className={`${heading} mb-3`}>{t('pty_record')}</h2>
      <RecordChart points={sv.chart} color={color} />
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
          <th className="py-2 font-semibold">{t('pty_year')}</th><th className="font-semibold">{t('pty_won_contested')}</th><th className="font-semibold">{t('pty_vote_share')}</th><th className="font-semibold">{t('pty_change')}</th>
        </tr></thead>
        <tbody>
          {sv.lines.map((l, i) => l.kind === 'election' ? (
            <tr key={i} className="border-b border-line/60">
              <td className="tabular py-2 font-semibold text-ink">{l.row.year}</td>
              <td className="tabular"><strong className="text-ink">{l.row.won}</strong> <span className="text-muted">/ {l.row.contested}</span></td>
              <td className="tabular text-ink">{fmtShare(l.row.share)}</td>
              <td><DeltaCell delta={l.delta} seatsLabel={seats} ptsLabel={pts} />{l.delta?.vsLabel && <span className="block text-[11px] text-muted">{t('pty_vs', { label: l.delta.vsLabel })}</span>}</td>
            </tr>
          ) : l.kind === 'event' ? (
            <tr key={i}><td colSpan={4} className="py-1.5"><span className="inline-flex rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent-text">
              + {t(`pty_event_${l.event.kind}`, { from: nameOf(l.event.predecessor_id), to: nameOf(l.event.party_id) })} · {l.event.effective_date.slice(0, 4)}</span></td></tr>
          ) : (
            <tr key={i}><td colSpan={4} className="py-1.5"><span className="block border-t border-dashed border-line pt-1 text-center text-[11px] uppercase tracking-wider text-muted">{t('pty_new_boundaries', { year: l.year })}</span></td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
