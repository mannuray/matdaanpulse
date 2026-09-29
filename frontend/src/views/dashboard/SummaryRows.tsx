import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSummaryValue, primaryCell, type SummaryCell, type SummaryRow, type SummarySection, type SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { cn } from '../ui/cn';

/** The single number formatter shared by the compact tab and the focus view (compact K, lakh L, pct, signed, "–"). */
export function useCellFormat() {
  const { t } = useTranslation();
  return (c: SummaryCell) => formatSummaryValue(c.value, c.format, { text: c.text, won: t('studio_status_won'), lost: t('studio_status_lost') });
}

/** The number a compact row shows for its section. */
export function useCellText() {
  const format = useCellFormat();
  return (r: SummaryRow, section: SummarySection) => format(primaryCell(r, section.primaryCol));
}

/** Every column of a row, in the order of the section's columnsKeys. */
export function rowCells(r: SummaryRow): SummaryCell[] {
  return [{ value: r.value, format: r.valueFormat, text: r.valueText }, ...(r.extra ?? [])];
}

export function rowActions(vm: SummaryVM, sectionId: string) {
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

/** Never leave a hover highlight on the map behind when the rows go away (layer change, tab switch, close). */
export function useClearHoverOnChange(vm: SummaryVM, sections: SummarySection[]) {
  const onHover = useRef(vm.onHoverRow);
  useEffect(() => { onHover.current = vm.onHoverRow; });
  useEffect(() => () => onHover.current(null), [sections]);
}

/** One row. `full` shows every column (focus view); otherwise only the section's primary number (compact tab). */
export function Row({ r, section, vm, full = false }: { r: SummaryRow; section: SummarySection; vm: SummaryVM; full?: boolean }) {
  const { t } = useTranslation();
  const cellText = useCellText();
  const format = useCellFormat();
  const a = rowActions(vm, section.id)(r);
  const label = r.labelKey ? t(r.labelKey) : r.label;
  return (
    <button type="button" aria-pressed={a.single ? undefined : a.locked} onClick={a.onClick} onMouseEnter={a.onMouseEnter} onMouseLeave={a.onMouseLeave}
      className={cn('flex h-7 w-full shrink-0 items-center gap-2 rounded-[0.5rem] px-2 text-left text-xs hover:bg-tile-raised', a.locked && 'bg-tile-raised ring-1 ring-accent')}>
      {r.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} /> : <span className="h-2 w-2 shrink-0" />}
      {label && <span className={cn('min-w-0 truncate font-semibold text-ink', full ? 'max-w-[60%] shrink' : 'max-w-[55%] shrink-0')}>{label}</span>}
      <span className="min-w-0 flex-1 truncate text-muted">{r.sub ?? ''}</span>
      {r.bar && (
        <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-page">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (Math.abs(r.bar.value) / Math.max(1e-9, r.bar.max)) * 100)}%`, background: r.bar.color }} />
        </span>
      )}
      {full
        ? rowCells(r).map((c, i) => <span key={i} data-cell className="tabular w-24 shrink-0 text-right font-display text-base font-bold text-ink">{format(c)}</span>)
        : <span className="tabular shrink-0 text-right font-display text-base font-bold text-ink">{cellText(r, section)}</span>}
    </button>
  );
}

/** Rows shown as a row of big numbers (key stats, dominance, anti-incumbency ...). */
export function Stats({ section, vm, className }: { section: SummarySection; vm: SummaryVM; className?: string }) {
  const { t } = useTranslation();
  const cellText = useCellText();
  const actions = rowActions(vm, section.id);
  return (
    <div data-stats className={cn('grid shrink-0 gap-2 px-2', className ?? 'h-[52px]')} style={{ gridTemplateColumns: `repeat(${section.rows.length}, minmax(0, 1fr))` }}>
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
