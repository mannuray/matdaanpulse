import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SummarySection, SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { planSummaryFit } from '../../viewmodels/tiles/fit';
import { useElementHeight } from '../hooks/useElementHeight';
import { Row, Stats, useClearHoverOnChange } from './SummaryRows';

/** Content height of a rail card (150px card minus border, padding and the card title line). */
const PREVIEW_H = 100;
const PREVIEW_STATS_H = 56;

/** Mobile rail glance: the key stats, then as many rows of the first other section as fit under their header. Not interactive. */
export function SummaryPreview({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const sections = vm.summary.sections;
  const stats = sections.find(s => s.id === 'key_stats');
  const first = sections.find(s => s !== stats);
  const plan = useMemo(
    () => planSummaryFit([stats, first].filter((x): x is SummarySection => !!x), PREVIEW_H, { headerH: HEADER_H, rowH: ROW_H, gap: GAP, footerH: 0, statsH: PREVIEW_STATS_H }),
    [stats, first],
  );
  if (!stats && !first) return <p className="py-2 text-sm text-muted">{t('studio_no_layer_data')}</p>;
  return (
    <div className="flex flex-col gap-1">
      {plan.visible.map(v => {
        const s = v.sectionId === stats?.id ? stats : first!;
        return (
          <div key={s.id} className="flex flex-col gap-1">
            {s.titleKey && <h3 className="flex h-[22px] items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(s.titleKey, s.titleParams)}</h3>}
            {s.layout === 'stats' ? <Stats section={s} vm={vm} plain /> : s.rows.slice(0, v.rows).map(r => <Row key={r.id} r={r} section={s} vm={vm} plain />)}
          </div>
        );
      })}
    </div>
  );
}

const HEADER_H = 22;
const ROW_H = 28;
const GAP = 4;
/** Height of a stats block (three big numbers with their labels). */
const STATS_H = 52;
/** "+N more" footer: 20px line plus the gap above it. */
const FOOTER_H = 24;

/** Compact summary for the active layer: as many sections/rows as fit, then a "+N more" link to the focus view. */
export function SummaryTab({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const [ref, height] = useElementHeight<HTMLDivElement>();
  const sections = vm.summary.sections;
  const plan = useMemo(
    () => planSummaryFit(sections, height, { headerH: HEADER_H, rowH: ROW_H, gap: GAP, footerH: FOOTER_H, statsH: STATS_H }),
    [sections, height],
  );
  useClearHoverOnChange(vm, sections);

  const parts = [
    plan.hiddenRows > 0 ? t('studio_sum_more_rows', { count: plan.hiddenRows }) : '',
    plan.hiddenSections > 0 ? t('studio_sum_more_sections', { count: plan.hiddenSections }) : '',
  ].filter(Boolean);
  return (
    <div ref={ref} className="flex h-full flex-col gap-1">
      {sections.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_layer_data')}</p>}
      {plan.visible.map(v => {
        const s = sections.find(x => x.id === v.sectionId)!;
        return (
          <div key={s.id} className="flex flex-col gap-1">
            {s.titleKey && <h3 className="flex h-[22px] shrink-0 items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(s.titleKey, s.titleParams)}</h3>}
            {s.layout === 'stats' ? <Stats section={s} vm={vm} /> : s.rows.slice(0, v.rows).map(r => <Row key={r.id} r={r} section={s} vm={vm} />)}
          </div>
        );
      })}
      {parts.length > 0 && (
        <button type="button" onClick={vm.onFocus} className="mt-auto h-5 shrink-0 px-2 text-left text-xs text-muted hover:text-accent">{parts.join(' · ')}</button>
      )}
    </div>
  );
}
