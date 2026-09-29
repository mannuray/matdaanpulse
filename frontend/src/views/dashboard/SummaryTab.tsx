import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSummaryValue, primaryCell, type SummaryRow, type SummarySection, type SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { planSummaryFit } from '../../viewmodels/tiles/fit';
import { useElementHeight } from '../hooks/useElementHeight';
import { cn } from '../ui/cn';

const HEADER_H = 22;
const ROW_H = 28;
const GAP = 4;
/** Height of a stats block (three big numbers with their labels). */
const STATS_H = 52;
/** "+N more" footer: 20px line plus the gap above it. */
const FOOTER_H = 24;

/** The number a compact row shows, formatted with translated words where a format needs them. */
function useCellText() {
  const { t } = useTranslation();
  return (r: SummaryRow, section: SummarySection) => {
    const c = primaryCell(r, section.primaryCol);
    return formatSummaryValue(c.value, c.format, { text: c.text, won: t('studio_status_won'), lost: t('studio_status_lost') });
  };
}

function rowActions(vm: SummaryVM, sectionId: string) {
  return (r: SummaryRow) => {
    const single = r.seatIds?.length === 1 ? r.seatIds[0] : null;
    return {
      single,
      locked: vm.lockedRowId === `${sectionId}:${r.id}`,
      onClick: () => (single ? vm.onSelectSeat(single) : vm.onLockRow(r)),
      onMouseEnter: () => vm.onHoverRow(r),
      onMouseLeave: () => vm.onHoverRow(null),
    };
  };
}

function Row({ r, section, vm }: { r: SummaryRow; section: SummarySection; vm: SummaryVM }) {
  const { t } = useTranslation();
  const cellText = useCellText();
  const a = rowActions(vm, section.id)(r);
  const label = r.labelKey ? t(r.labelKey) : r.label;
  return (
    <button type="button" aria-pressed={a.single ? undefined : a.locked} onClick={a.onClick} onMouseEnter={a.onMouseEnter} onMouseLeave={a.onMouseLeave}
      className={cn('flex h-7 w-full shrink-0 items-center gap-2 rounded-[0.5rem] px-2 text-left text-xs hover:bg-tile-raised', a.locked && 'bg-tile-raised ring-1 ring-accent')}>
      {r.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} /> : <span className="h-2 w-2 shrink-0" />}
      {label && <span className="min-w-0 max-w-[55%] shrink-0 truncate font-semibold text-ink">{label}</span>}
      <span className="min-w-0 flex-1 truncate text-muted">{r.sub ?? ''}</span>
      {r.bar && (
        <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-page">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (Math.abs(r.bar.value) / Math.max(1e-9, r.bar.max)) * 100)}%`, background: r.bar.color }} />
        </span>
      )}
      <span className="tabular shrink-0 text-right font-display text-base font-bold text-ink">{cellText(r, section)}</span>
    </button>
  );
}

/** Rows shown as a row of big numbers (key stats, dominance, anti-incumbency ...). */
function Stats({ section, vm }: { section: SummarySection; vm: SummaryVM }) {
  const { t } = useTranslation();
  const cellText = useCellText();
  const actions = rowActions(vm, section.id);
  return (
    <div className="grid h-[52px] shrink-0 gap-2 px-2" style={{ gridTemplateColumns: `repeat(${section.rows.length}, minmax(0, 1fr))` }}>
      {section.rows.map(r => {
        const a = actions(r);
        return (
          <button key={r.id} type="button" aria-pressed={a.single ? undefined : a.locked} onClick={a.onClick} onMouseEnter={a.onMouseEnter} onMouseLeave={a.onMouseLeave}
            className={cn('flex min-w-0 flex-col items-start justify-center rounded-[0.5rem] px-2 text-left hover:bg-tile-raised', a.locked && 'bg-tile-raised ring-1 ring-accent')}>
            <span className="tabular font-display text-2xl font-bold leading-none text-ink">{cellText(r, section)}</span>
            <span className="mt-1 max-w-full truncate text-[10px] font-semibold uppercase tracking-wider text-muted">{r.labelKey ? t(r.labelKey) : r.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact summary for the active layer: as many sections/rows as fit, then a "+N more" link to the focus view. */
export function SummaryTab({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const [ref, height] = useElementHeight<HTMLDivElement>();
  const sections = vm.summary.sections;
  const plan = useMemo(
    () => planSummaryFit(sections, height, { headerH: HEADER_H, rowH: ROW_H, gap: GAP, footerH: FOOTER_H, statsH: STATS_H }),
    [sections, height],
  );
  // Never leave a hover highlight on the map behind when the rows go away (layer change, tab switch).
  const onHover = useRef(vm.onHoverRow);
  useEffect(() => { onHover.current = vm.onHoverRow; });
  useEffect(() => () => onHover.current(null), [sections]);

  const chartOnly = sections.length > 0 && sections.every(s => s.rows.length === 0);
  const parts = [
    plan.hiddenRows > 0 ? t('studio_sum_more_rows', { count: plan.hiddenRows }) : '',
    plan.hiddenSections > 0 ? t('studio_sum_more_sections', { count: plan.hiddenSections }) : '',
  ].filter(Boolean);
  const titleRows = chartOnly ? Math.max(1, Math.floor((height - FOOTER_H + GAP) / (ROW_H + GAP))) : 0;
  return (
    <div ref={ref} className="flex h-full flex-col gap-1">
      {sections.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_layer_data')}</p>}
      {chartOnly && sections.slice(0, titleRows).map(s => (
        <button key={s.id} type="button" onClick={vm.onFocus}
          className="flex h-7 w-full shrink-0 items-center rounded-[0.5rem] px-2 text-left text-xs font-semibold text-ink hover:bg-tile-raised hover:text-accent">
          {t(s.titleKey, s.titleParams)}
        </button>
      ))}
      {chartOnly && sections.length > titleRows && (
        <button type="button" onClick={vm.onFocus} className="mt-auto h-5 shrink-0 px-2 text-left text-xs text-muted hover:text-accent">
          {t('studio_sum_more_sections', { count: sections.length - titleRows })}
        </button>
      )}
      {!chartOnly && plan.visible.map(v => {
        const s = sections.find(x => x.id === v.sectionId)!;
        return (
          <div key={s.id} className="flex flex-col gap-1">
            {s.titleKey && <h3 className="flex h-[22px] shrink-0 items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(s.titleKey, s.titleParams)}</h3>}
            {s.layout === 'stats' ? <Stats section={s} vm={vm} /> : s.rows.slice(0, v.rows).map(r => <Row key={r.id} r={r} section={s} vm={vm} />)}
          </div>
        );
      })}
      {!chartOnly && parts.length > 0 && (
        <button type="button" onClick={vm.onFocus} className="mt-auto h-5 shrink-0 px-2 text-left text-xs text-muted hover:text-accent">{parts.join(' · ')}</button>
      )}
    </div>
  );
}
