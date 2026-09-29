import { useTranslation } from 'react-i18next';
import type { LayerInsightVM, InsightChip } from '../../viewmodels/tiles/useLayerInsightVM';
import { cn } from '../ui/cn';

function Chip({ c, vm }: { c: InsightChip; vm: LayerInsightVM }) {
  const { t } = useTranslation();
  const label = c.labelKey ? t(c.labelKey) : c.label;
  return (
    <button type="button" onClick={() => vm.onLockChip(c)} onMouseEnter={() => vm.onHoverChip(c)} onMouseLeave={() => vm.onHoverChip(null)}
      aria-pressed={vm.lockedChipId === c.id}
      className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line bg-page/60 px-3 text-sm hover:border-accent', vm.lockedChipId === c.id && 'border-accent bg-tile-raised')}>
      {c.fromColor && <span className="h-2 w-2 rounded-full" style={{ background: c.fromColor }} />}
      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      <span className="font-medium text-ink">{label}</span>
      <span className="tabular font-display text-lg font-bold text-ink">{c.count}</span>
    </button>
  );
}

export function LayerInsightStrip({ vm, variant }: { vm: LayerInsightVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  if (!vm.insight) return variant === 'tile' ? <div className="rounded-tile border border-line bg-tile px-4 py-3 text-sm text-muted">{t('studio_no_layer_data')}</div> : null;
  const headline = t(vm.insight.headlineKey, vm.insight.headlineParams);
  if (variant === 'focus') {
    return (
      <div className="flex flex-col gap-5">
        <p className="font-display text-2xl font-bold text-ink">{headline}</p>
        <div className="flex flex-wrap gap-2">{vm.insight.chips.map(c => <Chip key={c.id} c={c} vm={vm} />)}</div>
        {vm.layer === 'swing' && vm.netSwing.length > 0 && (
          <table className="w-full max-w-xl text-sm"><tbody>
            {vm.netSwing.map(r => (
              <tr key={r.id} className="border-b border-line"><td className="py-1.5"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.name}</td>
                <td className="tabular text-right text-muted">+{r.gained}</td><td className="tabular text-right text-muted">−{r.lost}</td>
                <td className="tabular text-right font-semibold">{r.gained - r.lost >= 0 ? '+' : ''}{r.gained - r.lost}</td></tr>
            ))}
          </tbody></table>
        )}
        {vm.layer === 'history' && vm.marginTrend.length > 0 && (
          <table className="w-full max-w-xl text-sm"><thead><tr className="text-muted"><th className="text-left">{t('studio_year')}</th><th className="text-right">{t('studio_avg_margin')}</th><th className="text-right">{t('studio_median_margin')}</th></tr></thead><tbody>
            {vm.marginTrend.map(p => <tr key={p.year} className="border-b border-line"><td className="py-1.5">{p.year}</td><td className="tabular text-right">{p.avgMargin.toLocaleString()}</td><td className="tabular text-right">{p.medianMargin.toLocaleString()}</td></tr>)}
          </tbody></table>
        )}
        {vm.layer === 'history' && vm.partySwitches.length > 0 && (
          <p className="text-sm text-muted">{t('studio_party_switchers', { count: vm.partySwitches.length })}</p>
        )}
      </div>
    );
  }
  return (
    <section className="flex min-w-0 items-center gap-4 overflow-hidden rounded-tile border border-line bg-tile px-4">
      <p className="shrink-0 font-display text-lg font-bold text-ink">{headline}</p>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">{vm.insight.chips.map(c => <Chip key={c.id} c={c} vm={vm} />)}</div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: headline })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
