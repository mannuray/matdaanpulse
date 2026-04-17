import { useRef, useEffect, useCallback } from 'react';
import { select } from 'd3-selection';
import { geoMercator, geoPath } from 'd3-geo';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import type { Selection } from 'd3-selection';
import type { ZoomBehavior } from 'd3-zoom';
import type { GeoPath, GeoPermissibleObjects } from 'd3-geo';
import { featureName } from '../../utils/geoHelpers';

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
  MAP_BG: string;
}

export function useMapRendering({
  loaded,
  geoRef,
  stateGeoRef,
  isVS,
  geoConfig,
  MAP_WIDTH,
  MAP_HEIGHT,
  MAP_BG
}: UseMapRenderingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const pathGenRef = useRef<GeoPath<unknown, GeoPermissibleObjects> | null>(null);

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
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', 4)
      .attr('stroke', 'rgba(0,0,0,0.35)')
      .attr('stroke-width', 1.5);

    let projection = geoMercator();
    
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

    const g = svg.append('g');
    gRef.current = g;

    g.append('rect')
      .attr('x', -5000)
      .attr('y', -5000)
      .attr('width', 15000)
      .attr('height', 15000)
      .attr('fill', MAP_BG);

    // Initial PC paths with stable keys for high-performance updates
    g.selectAll('path.pc')
      .data(geoRef.current.features, (d: any) => featureName(d.properties) + (d.properties.st_name || ''))
      .join('path')
      .attr('class', 'pc')
      .attr('d', (d: any) => pathGen(d) || '')
      .attr('fill', '#fff')
      .attr('stroke', '#000')
      .attr('stroke-width', 0.2)
      .attr('cursor', 'pointer');

    if (stateGeoRef.current) {
      g.selectAll('path.state')
        .data(stateGeoRef.current.features)
        .join('path')
        .attr('class', 'state')
        .attr('d', (d: any) => pathGen(d) || '')
        .attr('fill', 'none')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    }

    // Initial PC labels
    g.selectAll('text.pc-label')
      .data(geoRef.current.features)
      .join('text')
      .attr('class', 'pc-label')
      .attr('x', (d: any) => (pathGen.centroid(d) || [0, 0])[0])
      .attr('y', (d: any) => (pathGen.centroid(d) || [0, 0])[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('pointer-events', 'none')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#1a1a1a')
      .attr('stroke', '#fff')
      .attr('stroke-width', 5)
      .attr('paint-order', 'stroke')
      .attr('opacity', 0);

    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 80])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        g.selectAll('path.pc').attr('stroke-width', 0.2 / event.transform.k);
        g.selectAll('path.state').attr('stroke-width', 1 / event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
  }, [loaded, isVS, geoConfig, MAP_WIDTH, MAP_HEIGHT, MAP_BG, geoRef, stateGeoRef]);

  return { svgRef, gRef, zoomRef, pathGenRef, handleResetZoom };
}
