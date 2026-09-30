import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SummarySection, SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { planSummaryFit } from '../../viewmodels/tiles/fit';
import { Row, Stats, useClearHoverOnChange } from './SummaryRows';

/** Content height of a rail card (150px card minus border, padding and the card title line). */
const PREVIEW_H = 100;
const PREVIEW_STATS_H = 56;
const HEADER_H = 22;
const ROW_H = 28;
const GAP = 4;

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

/**
 * The side-card summary for the active layer: every section with every row, inside the card's scroll area. A section's
 * header sticks to the top while its rows scroll under it. Chart-only sections (no rows) are skipped.
 */
export function SummaryTab({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const sections = vm.summary.sections.filter(s => s.rows.length > 0);
  useClearHoverOnChange(vm, vm.summary.sections);
  if (sections.length === 0) return <p className="py-6 text-center text-sm text-muted">{t('studio_no_layer_data')}</p>;
  return (
    <div className="flex flex-col gap-1">
      {sections.map(s => (
        <div key={s.id} className="flex flex-col gap-1">
          {s.titleKey && <h3 className="sticky top-0 z-10 flex h-[22px] shrink-0 items-center bg-tile px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(s.titleKey, s.titleParams)}</h3>}
          {s.layout === 'stats' ? <Stats section={s} vm={vm} /> : s.rows.map(r => <Row key={r.id} r={r} section={s} vm={vm} />)}
        </div>
      ))}
    </div>
  );
}
