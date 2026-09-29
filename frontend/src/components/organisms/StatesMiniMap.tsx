import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { select, geoMercator, geoPath, zoom as d3Zoom, zoomIdentity } from 'd3';
import type { Selection, ZoomBehavior } from 'd3';
import MapTooltip from '../molecules/MapTooltip';
import { featureName, normName } from '../../utils/geoHelpers';
import { buildRegionLookup, findRegionForFeature, displayStateName } from '../../utils/regionMatching';
import type { GeoFeature } from '../../utils/geoHelpers';

interface MapRegion {
  id: string;
  name: string;
  color: string;
  candidate?: string;
  party?: string;
  partyColor?: string;
  margin?: number;
  status?: string;
}

interface StatesMiniMapProps {
  stateName: string;
  features: GeoFeature[];
  regions: MapRegion[];
  selectedPartyColors: Map<string, string>;
  onRegionClick: (id: string) => void;
}

const DEFAULT_FILL = 'var(--map-default-fill)';

export default function StatesMiniMap({ stateName, features, regions, selectedPartyColors, onRegionClick }: StatesMiniMapProps) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [tooltip, setTooltip] = useState({
    visible: false, x: 0, y: 0, name: '', candidate: '', party: '', partyColor: '', margin: 0, status: '',
  });

  const regionLookup = useMemo(() => buildRegionLookup(regions), [regions]);
  const regionLookupRef = useRef(regionLookup);
  regionLookupRef.current = regionLookup;

  const onRegionClickRef = useRef(onRegionClick);
  onRegionClickRef.current = onRegionClick;

  const findRegion = (f: GeoFeature, lookup: Map<string, MapRegion>): MapRegion | undefined =>
    findRegionForFeature(lookup, f.properties);

  // Initial render: geometry, events, zoom — only depends on features + stateName
  useEffect(() => {
    if (!svgRef.current || features.length === 0) return;

    const width = 560;
    const height = 250;
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    const projection = geoMercator().fitSize([width - 16, height - 16], fc);
    projection.translate([projection.translate()[0] + 8, projection.translate()[1] + 8]);
    const pathGen = geoPath().projection(projection);

    const g = svg.append('g');
    gRef.current = g;

    // Constituency paths — use refs for event handlers to avoid re-bindng
    g.selectAll<SVGPathElement, GeoFeature>('path.pc')
      .data(features)
      .join('path')
      .attr('class', 'pc')
      .attr('d', (d) => pathGen(d) || '')
      .style('fill', DEFAULT_FILL)
      .attr('stroke-width', 0.15)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        const region = findRegion(d, regionLookupRef.current);
        const id = region?.id || normName(featureName(d.properties)).replace(/\s+/g, '_');
        onRegionClickRef.current(id);
      })
      .on('mousemove', (event: MouseEvent, d) => {
        const region = findRegion(d, regionLookupRef.current);
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          name: featureName(d.properties),
          candidate: region?.candidate || '',
          party: region?.party || '',
          partyColor: region?.partyColor || region?.color || '',
          margin: region?.margin || 0,
          status: region?.status || '',
        });
      })
      .on('mouseleave', () => {
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

    // State outer boundary
    g.append('path')
      .attr('class', 'state-border')
      .datum(fc)
      .attr('d', (d) => pathGen(d) || '')
      .attr('stroke-width', 0.6)
      .attr('pointer-events', 'none');

    // Zoom + pan
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        g.selectAll('path.pc').attr('stroke-width', 0.15 / event.transform.k);
        g.select('path.state-border').attr('stroke-width', 0.6 / event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
  }, [features, stateName]);

  // Color update: runs when regions or selectedPartyColors change, without rebuilding geometry
  useEffect(() => {
    if (!gRef.current) return;

    gRef.current.selectAll<SVGPathElement, GeoFeature>('path.pc')
      .style('fill', (d) => {
        const r = findRegion(d, regionLookup);
        if (!r || !r.party) return DEFAULT_FILL;
        if (selectedPartyColors.size === 0) return r.color || DEFAULT_FILL;
        return selectedPartyColors.get(r.party) || r.color || DEFAULT_FILL;
      });
  }, [regionLookup, selectedPartyColors]);

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.transform, zoomIdentity);
    }
  };

  // Build seat summary per party
  const summary = useMemo(() => {
    const counts = new Map<string, { name: string; color: string; seats: number }>();
    regions.forEach((r) => {
      if (!r.party) return;
      const existing = counts.get(r.party);
      if (existing) existing.seats++;
      else counts.set(r.party, { name: r.party, color: r.partyColor || r.color, seats: 1 });
    });
    return [...counts.values()].sort((a, b) => b.seats - a.seats).slice(0, 5);
  }, [regions]);

  // Display-friendly state name
  const displayName = displayStateName(stateName);

  return (
    <div className="state-minimap">
      <div className="state-minimap-header">
        <span>{displayName} ({features.length})</span>
        <span className="state-minimap-summary">
          <button
            onClick={handleResetZoom}
            className="filter-chip"
            title={t('reset_zoom')}
            style={{ fontSize: 9, padding: '1px 6px', marginRight: 6 }}
          >
            {t('reset')}
          </button>
          {summary.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' · '}
              <span style={{ color: s.color, fontWeight: 600 }}>{s.name}</span> {s.seats}
            </span>
          ))}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 560 250"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', display: 'block', background: 'var(--bg-secondary)', cursor: 'grab' }}
      />
      <MapTooltip {...tooltip} />
    </div>
  );
}
