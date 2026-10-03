import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayerId, SummarySection, SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
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
    () => planSummaryFit([stats, first].filter((x): x is SummarySection => !!x), PREVIEW_H, { headerH: HEADER_H, rowH: ROW_H, gap: GAP, statsH: PREVIEW_STATS_H }),
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

/** One collapsible section of the side card: the header toggles its rows and shows the row count while collapsed. */
function CardSection({ s, vm, open, onToggle }: { s: SummarySection; vm: SummaryVM; open: boolean; onToggle(): void }) {
  const { t } = useTranslation();
  const bodyId = useId();
  return (
    <div className="flex flex-col gap-1">
      <h3 className="sticky top-0 z-10 flex h-[22px] shrink-0 items-center border-b border-line bg-tile text-[11px] font-semibold uppercase tracking-wider text-muted">
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}
          className="flex h-full w-full items-center gap-2 px-2 text-left uppercase tracking-wider hover:text-ink">
          <span className="min-w-0 flex-1 truncate">{t(s.titleKey, s.titleParams)}</span>
          {!open && <span aria-hidden className="tabular rounded-full bg-tile-raised px-1.5 text-[10px]">{s.rows.length}</span>}
          <span aria-hidden className={`text-sm leading-none transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        </button>
      </h3>
      {open && <div id={bodyId} data-section-body className="flex flex-col gap-1">{s.rows.map(r => <Row key={r.id} r={r} section={s} vm={vm} />)}</div>}
    </div>
  );
}

/**
 * The side-card summary for the active layer, inside the card's scroll area. The key stats always show; of the other
 * sections only the first starts open and the rest are collapsible headers (a new layer starts over). A section's header
 * sticks to the top while its rows scroll under it. Chart-only sections (no rows) are skipped.
 */
export function SummaryTab({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const sections = vm.summary.sections.filter(s => s.rows.length > 0);
  useClearHoverOnChange(vm, vm.summary.sections);
  // Only the user's toggles are stored (per layer); untouched sections follow "first one open", so data that arrives
  // after the first render still opens its first section.
  const firstId = sections.find(s => s.layout !== 'stats' && s.titleKey)?.id ?? null;
  const [toggled, setToggled] = useState<{ layer: LayerId; open: Map<string, boolean> }>(() => ({ layer: vm.layer, open: new Map() }));
  const choices = toggled.layer === vm.layer ? toggled.open : new Map<string, boolean>();
  const isOpen = (id: string) => choices.get(id) ?? id === firstId;
  const toggle = (id: string) => setToggled({ layer: vm.layer, open: new Map(choices).set(id, !isOpen(id)) });
  if (sections.length === 0) return <p className="py-6 text-center text-sm text-muted">{t('studio_no_layer_data')}</p>;
  return (
    <div className="flex flex-col gap-1">
      {sections.map(s => s.layout === 'stats' || !s.titleKey ? (
        <div key={s.id} className="flex flex-col gap-1">
          {s.titleKey && <h3 className="sticky top-0 z-10 flex h-[22px] shrink-0 items-center border-b border-line bg-tile px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(s.titleKey, s.titleParams)}</h3>}
          {s.layout === 'stats' ? <Stats section={s} vm={vm} /> : s.rows.map(r => <Row key={r.id} r={r} section={s} vm={vm} />)}
        </div>
      ) : (
        <CardSection key={s.id} s={s} vm={vm} open={isOpen(s.id)} onToggle={() => toggle(s.id)} />
      ))}
    </div>
  );
}
