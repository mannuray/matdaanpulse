import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { select } from 'd3';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import { useMapRendering } from './useMapRendering';

const W = 560;
const H = 680;

export function MapCanvas({ vm }: { vm: MapVM }) {
  const { t } = useTranslation();
  const geoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const stateGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  geoRef.current = vm.features.length ? { type: 'FeatureCollection', features: vm.features } : null;
  stateGeoRef.current = vm.stateFeatures ? { type: 'FeatureCollection', features: vm.stateFeatures } : null;
  const loaded = vm.status === 'ready' && vm.features.length > 0;
  const { svgRef, gRef, handleResetZoom } = useMapRendering({ loaded, geoRef, stateGeoRef, isVS: vm.isVS, geoConfig: vm.geoConfig, MAP_WIDTH: W, MAP_HEIGHT: H, showLabels: true });
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  // Hover only outlines the seat and shows the tooltip; it never dims the map.
  const hoveredId = tip?.id ?? null;
  const vmRef = useRef(vm);
  vmRef.current = vm;

  // Events, bound once per geometry (useMapRendering rebuilds paths when geometry/config change).
  useEffect(() => {
    if (!loaded || !gRef.current) return;
    gRef.current.selectAll<SVGPathElement, GeoFeature>('path.pc')
      .style('cursor', 'pointer')
      .style('vector-effect', 'non-scaling-stroke')
      .on('click', (_e, d) => { const id = vmRef.current.seatOf.get(d); if (id) vmRef.current.onSelect(id); })
      .on('mousemove', (e: MouseEvent, d) => { const id = vmRef.current.seatOf.get(d); setTip(id ? { id, x: e.clientX, y: e.clientY } : null); })
      .on('mouseleave', () => setTip(null));
  }, [loaded, gRef, vm.features, vm.stateFeatures, vm.geoConfig]);

  // Fills from the view-model.
  useEffect(() => {
    if (!loaded || !gRef.current) return;
    gRef.current.selectAll<SVGPathElement, GeoFeature>('path.pc').each(function (d) {
      const id = vm.seatOf.get(d);
      const fill = id ? vm.fills.get(id) : undefined;
      const el = select(this);
      const outlined = !!id && (id === vm.selectedSeat || id === hoveredId);
      el.style('fill', fill?.color ?? 'var(--color-map-pending)')
        .style('fill-opacity', String(fill?.opacity ?? 1))
        .style('stroke', outlined ? 'var(--color-ink)' : 'var(--color-map-stroke)')
        .style('stroke-width', outlined ? '1.5px' : '0.4px')
        .classed('studio-seat-pulse', !!id && vm.recentSeats.has(id));
    });
  }, [loaded, gRef, vm.fills, vm.seatOf, vm.selectedSeat, hoveredId, vm.recentSeats, vm.geoConfig, vm.stateFeatures]);

  const info = tip ? vm.seatInfo(tip.id) : null;
  return (
    <div className="relative h-full w-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full [&_.map-bg]:fill-[var(--color-map-bg)] [&_path.state]:stroke-line" role="img" />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button type="button" onClick={handleResetZoom} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-tile text-muted hover:text-ink" aria-label={t('studio_reset_zoom')}>⟳</button>
      </div>
      {info && tip && createPortal(
        <div className="studio-root pointer-events-none fixed z-30 rounded-xl border border-l-[3px] border-line border-l-[var(--seat-color)] bg-page/95 px-3 py-2 text-xs shadow-xl" style={{ left: tip.x + 14, top: tip.y - 12, '--seat-color': info.color } as CSSProperties}>
          <div className="font-display text-sm font-bold uppercase text-ink">{info.name}</div>
          {info.candidate && <div className="text-ink">{info.candidate}</div>}
          <div className="text-muted">{info.party} · {info.status}{info.margin ? ` · +${info.margin.toLocaleString()}` : ''}</div>
        </div>,
        document.body,
      )}
    </div>
  );
}
