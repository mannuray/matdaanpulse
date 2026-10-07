import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { select } from 'd3';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import { useMapRendering } from './useMapRendering';
import { PartyMark } from '../ui/PartyMark';

const W = 560;
const H = 680;

export function MapCanvas({ vm }: { vm: MapVM }) {
  const { t } = useTranslation();
  const geoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const stateGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  geoRef.current = vm.features.length ? { type: 'FeatureCollection', features: vm.features } : null;
  stateGeoRef.current = vm.stateFeatures ? { type: 'FeatureCollection', features: vm.stateFeatures } : null;
  const loaded = vm.status === 'ready' && vm.features.length > 0;
  const { svgRef, gRef, handleResetZoom } = useMapRendering({ loaded, geoRef, stateGeoRef, isVS: vm.isVS, geoConfig: vm.geoConfig, MAP_WIDTH: W, MAP_HEIGHT: H, showLabels: true, geometry: [vm.features, vm.stateFeatures] });
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
    const g = gRef.current;
    g.selectAll<SVGPathElement, GeoFeature>('path.pc').each(function (d) {
      const id = vm.seatOf.get(d);
      const fill = id ? vm.fills.get(id) : undefined;
      const el = select(this);
      const outlined = !!id && (id === vm.selectedSeat || id === hoveredId);
      // A too-close seat while live: a dashed outline in its own colour (reads as undecided, not missing).
      const dashed = !outlined && !!fill?.dashed;
      el.style('fill', fill?.color ?? 'var(--color-map-pending)')
        .style('fill-opacity', String(fill?.opacity ?? 1))
        .style('stroke', outlined ? 'var(--color-ink)' : dashed ? fill!.color : 'var(--color-map-stroke)')
        .style('stroke-width', outlined ? '1.5px' : dashed ? '1px' : '0.4px')
        .style('stroke-dasharray', dashed ? '3 2' : 'none')
        .attr('data-highlighted', fill?.highlighted ? 'true' : null)
        .attr('data-pulse', id ? vm.recentSeats.get(id) ?? null : null)
        .classed('studio-seat-pulse', !!id && vm.recentSeats.has(id));
    });
  }, [loaded, gRef, vm.fills, vm.seatOf, vm.selectedSeat, hoveredId, vm.recentSeats, vm.geoConfig, vm.stateFeatures]);

  // Regions layer: each region's outline from its own seats (no region shapes). Per region: the seats' shapes with a thick
  // stroke, their fills on top (hiding the stroke inside the region, so only the outer edge shows), then thin seat
  // borders. The highlighted region's outline is strong. Rebuilt when the regions, fills or geometry change.
  useEffect(() => {
    if (!loaded || !gRef.current) return;
    const g = gRef.current;
    g.select('g.region-outlines').remove();
    if (!vm.regionOutlines.length) return;
    const pathOf = new Map<string, string>();
    g.selectAll<SVGPathElement, GeoFeature>('path.pc').each(function (d) {
      const id = vm.seatOf.get(d);
      const p = this.getAttribute('d');
      if (id && p) pathOf.set(id, p);
    });
    const layer = g.insert('g', 'g.pc-highlight, path.state, text.pc-label').attr('class', 'region-outlines').attr('pointer-events', 'none');
    // Strong (highlighted) region last, so its outline sits on top of its neighbours'.
    for (const r of [...vm.regionOutlines].sort((a, b) => Number(a.strong) - Number(b.strong))) {
      const grp = layer.append('g').attr('data-region', r.name);
      const ids = r.seatIds.filter(id => pathOf.has(id));
      grp.selectAll('path.edge').data(ids).join('path').attr('class', 'edge').attr('d', id => pathOf.get(id)!)
        .style('fill', 'none').style('stroke', 'var(--color-ink)').style('stroke-opacity', r.strong ? '1' : '0.55')
        .style('stroke-width', r.strong ? '3px' : '1.6px').style('stroke-linejoin', 'round').style('vector-effect', 'non-scaling-stroke');
      grp.selectAll('path.cover').data(ids).join('path').attr('class', 'cover').attr('d', id => pathOf.get(id)!)
        .style('fill', id => vm.fills.get(id)?.color ?? 'var(--color-map-pending)').style('fill-opacity', id => String(vm.fills.get(id)?.opacity ?? 1))
        .style('stroke', 'var(--color-map-stroke)').style('stroke-width', '0.4px').style('vector-effect', 'non-scaling-stroke');
    }
  }, [loaded, gRef, vm.regionOutlines, vm.fills, vm.seatOf, vm.geoConfig, vm.features]);

  // The highlight outline: copies of the highlighted seats' shapes on a layer above the seats but below state borders and labels.
  // Keyed by seat id, so a seat that stays highlighted keeps its outline untouched (no path re-parsing on tooltip hovers).
  useEffect(() => {
    if (!loaded || !gRef.current) return;
    const g = gRef.current;
    const nodes = new Map<string, SVGPathElement>();
    if (vm.outline) {
      g.selectAll<SVGPathElement, GeoFeature>('path.pc').each(function (d) {
        const id = vm.seatOf.get(d);
        if (id && vm.fills.get(id)?.highlighted) nodes.set(id, this);
      });
    }
    let layer = g.select<SVGGElement>('g.pc-highlight');
    if (layer.empty()) layer = g.insert('g', 'path.state, text.pc-label').attr('class', 'pc-highlight').attr('pointer-events', 'none');
    layer.selectAll<SVGPathElement, [string, SVGPathElement]>('path')
      .data([...nodes], d => d[0])
      .join(enter => enter.append('path').attr('d', d => d[1].getAttribute('d'))
        .style('fill', 'none').style('stroke', 'var(--color-ink)').style('stroke-width', '1.5px').style('vector-effect', 'non-scaling-stroke'));
  }, [loaded, gRef, vm.fills, vm.seatOf, vm.outline, vm.geoConfig, vm.stateFeatures]);

  const info = tip ? vm.seatInfo(tip.id) : null;
  return (
    <div className="relative h-full w-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full [&_.map-bg]:fill-[var(--color-map-bg)] [&_path.state]:stroke-line" role="img" aria-label={t('constituency_map')} />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button type="button" onClick={handleResetZoom} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-tile text-muted hover:text-ink" aria-label={t('studio_reset_zoom')}>⟳</button>
      </div>
      {info && tip && createPortal(
        <div className="studio-root pointer-events-none fixed z-30 rounded-xl border border-l-[3px] border-line border-l-[var(--seat-color)] bg-page/95 px-3 py-2 text-xs shadow-xl" style={{ left: tip.x + 14, top: tip.y - 12, '--seat-color': info.color } as CSSProperties}>
          <div className="flex items-center gap-2 font-display text-sm font-bold uppercase text-ink">{info.name}{info.type && info.type !== 'GEN' && <span className="rounded border border-line px-1 text-[10px]">{info.type}</span>}</div>
          {info.state && <div data-tip-state className="text-[11px] text-muted">{info.state}</div>}
          {info.candidate && <div className="text-ink">{info.candidate}</div>}
          <div className="flex items-center gap-1.5 text-muted">{info.party && <PartyMark mark={info.mark} color={info.color} label={info.party} />}{info.party} · {info.status}{info.margin ? ` · +${info.margin.toLocaleString('en-IN')}` : ''}</div>
          {info.live && (
            <div data-tip-live className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="text-ink">{info.live.call}</span>
              {info.live.leadSwitch && <span className="rounded px-1 text-white" style={{ background: 'var(--color-map-mo-switched)' }}>{t('studio_tip_lead_switch')}</span>}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
