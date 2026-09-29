import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SummaryVM, SummaryRow } from '../../viewmodels/tiles/useSummaryVM';
import { planSummaryFit } from '../../viewmodels/tiles/fit';
import { useElementHeight } from '../hooks/useElementHeight';
import { cn } from '../ui/cn';

const HEADER_H = 22;
const ROW_H = 28;
const GAP = 4;
/** "+N more" footer: 20px line plus the gap above it. */
const FOOTER_H = 24;

export function formatSummaryValue(v: number | null, format: SummaryRow['valueFormat']): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (format === 'pct') return `${v.toFixed(1)}%`;
  if (format === 'signed') return v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString()}`;
  return v.toLocaleString();
}

function Row({ r, sectionId, vm }: { r: SummaryRow; sectionId: string; vm: SummaryVM }) {
  const { t } = useTranslation();
  const single = r.seatIds?.length === 1 ? r.seatIds[0] : null;
  const locked = vm.lockedRowId === `${sectionId}:${r.id}`;
  const label = r.labelKey ? t(r.labelKey) : r.label;
  return (
    <button type="button" aria-pressed={single ? undefined : locked}
      onClick={() => (single ? vm.onSelectSeat(single) : vm.onLockRow(r))}
      onMouseEnter={() => vm.onHoverRow(r)} onMouseLeave={() => vm.onHoverRow(null)}
      className={cn('flex h-7 w-full shrink-0 items-center gap-2 rounded-[0.5rem] px-2 text-left text-xs hover:bg-tile-raised', locked && 'bg-tile-raised ring-1 ring-accent')}>
      {r.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} /> : <span className="h-2 w-2 shrink-0" />}
      <span className="min-w-0 max-w-[55%] shrink-0 truncate font-semibold text-ink">{label}</span>
      <span className="min-w-0 flex-1 truncate text-muted">{r.sub ?? ''}</span>
      {r.bar && (
        <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-page">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (r.bar.value / Math.max(1e-9, r.bar.max)) * 100)}%`, background: r.bar.color }} />
        </span>
      )}
      <span className="tabular shrink-0 text-right font-display text-base font-bold text-ink">{formatSummaryValue(r.value, r.valueFormat)}</span>
    </button>
  );
}

/** Compact summary for the active layer: as many sections/rows as fit, then a "+N more" link to the focus view. */
export function SummaryTab({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const [ref, height] = useElementHeight<HTMLDivElement>();
  const sections = vm.summary.sections;
  const plan = useMemo(
    () => planSummaryFit(sections, height, { headerH: HEADER_H, rowH: ROW_H, gap: GAP, footerH: FOOTER_H }),
    [sections, height],
  );
  const parts = [
    plan.hiddenRows > 0 ? t('studio_sum_more_rows', { rows: plan.hiddenRows }) : '',
    plan.hiddenSections > 0 ? t('studio_sum_more_sections', { sections: plan.hiddenSections }) : '',
  ].filter(Boolean);
  return (
    <div ref={ref} className="flex h-full flex-col gap-1">
      {sections.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_layer_data')}</p>}
      {plan.visible.map(v => {
        const s = sections.find(x => x.id === v.sectionId)!;
        return (
          <section key={s.id} className="flex flex-col gap-1">
            <h3 className="flex h-[22px] shrink-0 items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(s.titleKey, s.titleParams)}</h3>
            {s.rows.slice(0, v.rows).map(r => <Row key={r.id} r={r} sectionId={s.id} vm={vm} />)}
          </section>
        );
      })}
      {parts.length > 0 && (
        <button type="button" onClick={vm.onFocus} className="mt-auto h-5 shrink-0 px-2 text-left text-xs text-muted hover:text-accent">{parts.join(' · ')}</button>
      )}
    </div>
  );
}
