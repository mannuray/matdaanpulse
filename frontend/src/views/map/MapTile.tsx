import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { LayerId } from '../../model/types/dashboard';
import { Tile } from '../dashboard/Tile';
import { PillToggle } from '../ui/PillToggle';
import { MapCanvas } from './MapCanvas';

export function MapTile({ vm, variant, seatPanel, footer }: { vm: MapVM; variant: 'tile' | 'focus'; seatPanel?: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation();
  const layers = <PillToggle<LayerId> value={vm.layer} onChange={vm.onLayer} ariaLabel={t('studio_map_layers')} size="sm" options={vm.layers.map(l => ({ value: l, label: t(`map_tab_${l}`) }))} />;
  const mode = vm.hexAvailable ? <PillToggle value={vm.mapMode} onChange={vm.onMapMode} ariaLabel={t('studio_map_mode')} size="sm" options={[{ value: 'map', label: t('studio_map') }, { value: 'hex', label: t('studio_hex') }]} /> : null;
  const canvas = (
    <div className={variant === 'focus' ? 'relative h-full min-h-0 overflow-hidden' : 'relative min-h-0 flex-1'}>
      {vm.status === 'loading' && <p className="absolute inset-0 grid place-items-center text-sm text-muted">{t('loading_map')}</p>}
      {vm.status === 'error' && <p className="absolute inset-0 grid place-items-center text-sm text-live">{t('map_load_failed')}</p>}
      <MapCanvas vm={vm} />
      {vm.lockedLabel && (
        <button type="button" onClick={vm.onClearLock} className="absolute left-3 top-2 inline-flex items-center gap-2 rounded-full border border-accent bg-tile px-3 py-1 text-xs text-ink">
          {vm.lockedLabel} <span aria-hidden>✕</span><span className="sr-only">{t('studio_clear_highlight')}</span>
        </button>
      )}
    </div>
  );
  if (variant === 'focus') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex shrink-0 items-center gap-2">{layers}{mode}</div>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {canvas}
          <div className="min-h-0 overflow-y-auto">{seatPanel}</div>
        </div>
      </div>
    );
  }
  return <Tile title={t('constituency_map')} onExpand={vm.onFocus} actions={<>{layers}{mode}</>} bodyClassName="flex flex-col px-2 pb-2">{canvas}{footer}</Tile>;
}
