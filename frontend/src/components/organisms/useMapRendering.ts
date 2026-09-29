import { useRef, useEffect, useCallback } from 'react';
import { select, geoMercator, geoPath, zoom as d3Zoom, zoomIdentity, zoomTransform } from 'd3';
import type { Selection, ZoomBehavior, GeoPath, GeoPermissibleObjects } from 'd3';
import { featureName } from '../../utils/geoHelpers';
import type { GeoFeature } from '../../utils/geoHelpers';

interface GeoConfig {
  map_url?: string;
  center?: [number, number];
  zoom?: number;
}

interface UseMapRenderingProps {
  loaded: boolean;
  geoRef: React.MutableRefObject<GeoJSON.FeatureCollection | null>;
  stateGeoRef: React.MutableRefObject<GeoJSON.FeatureCollection | null>;
  isVS: boolean;
  geoConfig?: GeoConfig;
  MAP_WIDTH: number;
  MAP_HEIGHT: number;
  /** Whether constituency labels may be shown (e.g. only on the overview tab). */
  showLabels: boolean;
}

/** On-screen area (px²) a constituency must reach before its label is shown. */
export const LABEL_MIN_AREA = 10000;
/** Below this on-screen area an abbreviated label is used. */
export const LABEL_FULL_AREA = 24000;
/** Label font size in screen pixels (kept constant by scaling inversely with zoom). */
export const LABEL_FONT_PX = 9;

export function abbreviateName(name: string): string {
  const words = name.split(/[\s_]+/);
  if (words.length === 1 && name.length <= 6) return name;
  if (words[0].length <= 6) return words[0];
  return name.slice(0, 3) + '.';
}

/**
 * Pure label decision for a feature with projected (k=1) area `baseArea` at zoom `k`.
 * Returns null when the label should be hidden.
 */
export function labelFor(name: string, baseArea: number, k: number): { text: string; fontSize: number; strokeWidth: number } | null {
  const area = baseArea * k * k;
  if (area < LABEL_MIN_AREA) return null;
  return {
    text: area < LABEL_FULL_AREA ? abbreviateName(name) : name,
    fontSize: LABEL_FONT_PX / k,
    strokeWidth: 2.5 / k,
  };
}

export function useMapRendering({
  loaded,
  geoRef,
  stateGeoRef,
  isVS,
  geoConfig,
  MAP_WIDTH,
  MAP_HEIGHT,
  showLabels,
}: UseMapRenderingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const pathGenRef = useRef<GeoPath<unknown, GeoPermissibleObjects> | null>(null);
  const baseAreaRef = useRef<WeakMap<GeoFeature, number>>(new WeakMap());
  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  const updateLabels = useCallback((k: number) => {
    const g = gRef.current;
    if (!g) return;
    const labels = g.selectAll<SVGTextElement, GeoFeature>('text.pc-label');
    if (!showLabelsRef.current) {
      labels.attr('opacity', 0);
      return;
    }
    const areas = baseAreaRef.current;
    labels.each(function (d) {
      const info = labelFor(featureName(d.properties), areas.get(d) ?? 0, k);
      const el = select(this);
      if (!info) { el.attr('opacity', 0); return; }
      el.attr('opacity', 1)
        .attr('font-size', info.fontSize)
        .attr('stroke-width', info.strokeWidth)
        .text(info.text);
    });
  }, []);

  // Re-evaluate labels when visibility toggles (e.g. tab change).
  useEffect(() => {
    if (!loaded || !svgRef.current) return;
    updateLabels(zoomTransform(svgRef.current).k);
  }, [loaded, showLabels, updateLabels]);

  const handleResetZoom = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.transform, zoomIdentity);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !geoRef.current || !svgRef.current) return;
    if (!isVS && !stateGeoRef.current) return;

    const svg = select(svgRef.current);
    svg.classed('map-svg', true);
    svg.selectAll('g').remove();
    svg.selectAll('defs').remove();

    // Add hatched pattern for spoiler-affected seats
    const defs = svg.append('defs');
    const pattern = defs.append('pattern')
      .attr('id', 'spoiler-hatch')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 4)
      .attr('height', 4)
      .attr('patternTransform', 'rotate(45)');
    pattern.append('line')
      .attr('class', 'spoiler-hatch-line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', 4)
      .attr('stroke-width', 1.5);

    const projection = geoMercator();

    if (geoConfig?.center && geoConfig?.zoom) {
      projection
        .center(geoConfig.center)
        .scale(MAP_WIDTH * geoConfig.zoom)
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
    } else {
      projection
        .center([82, 23])
        .scale(MAP_WIDTH * 1.4)
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
    }

    if (isVS) {
      projection.fitSize([MAP_WIDTH, MAP_HEIGHT], geoRef.current);
    }

    const pathGen = geoPath().projection(projection);
    pathGenRef.current = pathGen;

    const features = geoRef.current.features as GeoFeature[];
    const areas = new WeakMap<GeoFeature, number>();
    for (const f of features) areas.set(f, Math.abs(pathGen.area(f)));
    baseAreaRef.current = areas;

    const g = svg.append('g');
    gRef.current = g;

    g.append('rect')
      .attr('class', 'map-bg')
      .attr('x', -5000)
      .attr('y', -5000)
      .attr('width', 15000)
      .attr('height', 15000);

    // Initial PC paths with stable keys for high-performance updates
    g.selectAll<SVGPathElement, GeoFeature>('path.pc')
      .data(features, (d) => featureName(d.properties) + (d.properties.st_name || ''))
      .join('path')
      .attr('class', 'pc')
      .attr('d', (d) => pathGen(d) || '')
      .style('fill', 'var(--map-default-fill)')
      .attr('stroke-width', 0.2)
      .attr('cursor', 'pointer');

    if (stateGeoRef.current) {
      g.selectAll<SVGPathElement, GeoJSON.Feature>('path.state')
        .data(stateGeoRef.current.features)
        .join('path')
        .attr('class', 'state')
        .attr('d', (d) => pathGen(d) || '')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    }

    // PC labels — visibility/size driven by zoom level (see updateLabels)
    g.selectAll<SVGTextElement, GeoFeature>('text.pc-label')
      .data(features)
      .join('text')
      .attr('class', 'pc-label')
      .attr('x', (d) => (pathGen.centroid(d) || [0, 0])[0])
      .attr('y', (d) => (pathGen.centroid(d) || [0, 0])[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('pointer-events', 'none')
      .attr('font-size', LABEL_FONT_PX)
      .attr('font-weight', 600)
      .attr('stroke-width', 2.5)
      .attr('paint-order', 'stroke')
      .attr('opacity', 0);

    let rafId = 0;
    let pendingK = 1;
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 80])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        g.selectAll('path.pc').attr('stroke-width', 0.2 / event.transform.k);
        g.selectAll('path.state').attr('stroke-width', 1 / event.transform.k);
        pendingK = event.transform.k;
        if (!rafId) {
          rafId = requestAnimationFrame(() => { rafId = 0; updateLabels(pendingK); });
        }
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    updateLabels(zoomTransform(svgRef.current).k);

    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [loaded, isVS, geoConfig, MAP_WIDTH, MAP_HEIGHT, geoRef, stateGeoRef, updateLabels]);

  return { svgRef, gRef, zoomRef, pathGenRef, handleResetZoom };
}
