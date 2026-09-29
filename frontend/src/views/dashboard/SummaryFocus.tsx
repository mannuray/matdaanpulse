import { useTranslation } from 'react-i18next';
import type { ChartSpec, LayerId, SummarySection, SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { PillToggle } from '../ui/PillToggle';
import { BarChart } from '../charts/BarChart';
import { GroupedBarChart } from '../charts/GroupedBarChart';
import { LineChart } from '../charts/LineChart';
import { Row, Stats, useClearHoverOnChange } from './SummaryRows';

function Chart({ spec, title }: { spec: ChartSpec; title: string }) {
  if (spec.series.length === 0) return null;
  const C = spec.type === 'line' ? LineChart : spec.type === 'groupedBar' ? GroupedBarChart : BarChart;
  return <div className="mt-3 px-2"><C spec={spec} title={title} /></div>;
}

/** Column header text: an i18n key is translated, anything else (a year, a bloc name) is shown as is. */
function useColumnLabel() {
  const { t, i18n } = useTranslation();
  return (k: string) => (i18n.exists(k) ? t(k) : k);
}

function Section({ s, vm }: { s: SummarySection; vm: SummaryVM }) {
  const { t } = useTranslation();
  const column = useColumnLabel();
  const title = t(s.titleKey, s.titleParams);
  if (s.layout === 'stats') {
    return (
      <section aria-label={title || undefined} className="min-w-0 lg:col-span-2">
        {s.titleKey && <h3 className="mb-1 flex h-[22px] items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>}
        <Stats section={s} vm={vm} className="h-[64px]" />
      </section>
    );
  }
  const hasBar = s.rows.some(r => r.bar);
  return (
    <section aria-label={title} className="min-w-0 rounded-[0.5rem] border border-line bg-page/40 p-3">
      <h3 className="mb-1 flex h-[22px] items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {s.columnsKeys && (
        <div role="row" className="flex h-5 items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <span className="h-2 w-2 shrink-0" />
          <span className="min-w-0 flex-1" />
          {hasBar && <span className="w-14 shrink-0" />}
          {s.columnsKeys.map((k, i) => <span key={`${k}:${i}`} role="columnheader" title={column(k)} className="w-24 shrink-0 truncate text-right">{column(k)}</span>)}
        </div>
      )}
      <div className="flex flex-col gap-1">{s.rows.map(r => <Row key={r.id} r={r} section={s} vm={vm} full />)}</div>
      {s.more ? <p className="mt-1 px-2 text-xs text-muted">{t('studio_sum_more_rows', { count: s.more })}</p> : null}
      {s.chart && <Chart spec={s.chart} title={title} />}
    </section>
  );
}

/** The expanded summary: every section of the active layer with all rows and its chart, plus the layer pills. */
export function SummaryFocus({ vm }: { vm: SummaryVM }) {
  const { t } = useTranslation();
  const sections = vm.summary.sections;
  useClearHoverOnChange(vm, sections);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">{t('studio_tab_summary', { layer: t(`map_tab_${vm.layer}`) })}</h2>
        <PillToggle<LayerId> value={vm.layer} onChange={vm.onLayer} ariaLabel={t('studio_map_layers')} size="sm"
          options={vm.layers.map(l => ({ value: l, label: t(`map_tab_${l}`) }))} />
      </div>
      {sections.length === 0 && <p className="py-10 text-center text-sm text-muted">{t('studio_no_layer_data')}</p>}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {sections.map(s => <Section key={s.id} s={s} vm={vm} />)}
      </div>
    </div>
  );
}
