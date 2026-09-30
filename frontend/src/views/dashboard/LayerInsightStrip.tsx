import { useTranslation } from 'react-i18next';
import type { LayerInsightVM, InsightChip } from '../../viewmodels/tiles/useLayerInsightVM';
import { cn } from '../ui/cn';
import { onKbdFocus } from '../ui/kbdFocus';

function Chip({ c, vm }: { c: InsightChip; vm: LayerInsightVM }) {
  const { t } = useTranslation();
  const label = c.labelKey ? t(c.labelKey) : c.label;
  return (
    <button type="button" onClick={() => vm.onLockChip(c)} onMouseEnter={() => vm.onHoverChip(c)} onMouseLeave={() => vm.onHoverChip(null)} onFocus={onKbdFocus(() => vm.onHoverChip(c))} onBlur={() => vm.onHoverChip(null)}
      aria-pressed={vm.lockedChipId === c.id}
      className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line bg-page/60 px-3 text-sm hover:border-accent', vm.lockedChipId === c.id && 'border-accent bg-tile-raised')}>
      {c.fromColor && <span className="h-2 w-2 rounded-full" style={{ background: c.fromColor }} />}
      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      <span className="font-medium text-ink">{label}</span>
      <span className="tabular font-display text-lg font-bold text-ink">{c.count}</span>
    </button>
  );
}

export function LayerInsightStrip({ vm, variant }: { vm: LayerInsightVM; variant: 'tile' | 'footer' }) {
  const { t } = useTranslation();
  if (!vm.insight && variant === 'footer') return null;
  if (!vm.insight) return variant === 'tile' ? <div className="rounded-tile border border-line bg-tile px-4 py-3 text-sm text-muted">{t('studio_no_layer_data')}</div> : null;
  const headline = t(vm.insight.headlineKey, vm.insight.headlineParams);
  if (variant === 'footer') {
    return (
      <div className="flex h-10 shrink-0 min-w-0 items-center gap-3 overflow-hidden border-t border-line px-2">
        {vm.layer !== 'overview' && <p className="shrink-0 font-display text-base font-bold text-ink">{headline}</p>}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">{vm.insight.chips.map(c => <Chip key={c.id} c={c} vm={vm} />)}</div>
        <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: headline })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
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
