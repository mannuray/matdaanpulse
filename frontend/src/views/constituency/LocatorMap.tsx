import { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3';
import type { GeoFeature } from '../../model/geo/geoHelpers';

const W = 240, H = 200;

export function LocatorMap({ features, seat, label }: { features: GeoFeature[]; seat: GeoFeature | null; label: string }) {
  const paths = useMemo(() => {
    const fc = { type: 'FeatureCollection' as const, features };
    const proj = geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], fc);
    const path = geoPath(proj);
    return features.map((f, i) => ({ key: i, d: path(f) ?? '', on: f === seat }));
  }, [features, seat]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {paths.map(p => <path key={p.key} d={p.d} className={p.on ? 'fill-accent stroke-accent' : 'fill-tile-raised stroke-line'} strokeWidth={0.5} />)}
    </svg>
  );
}
