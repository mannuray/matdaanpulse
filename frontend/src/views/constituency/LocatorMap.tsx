import { useId, useMemo } from 'react';
import { geoMercator, geoPath } from 'd3';
import type { GeoFeature } from '../../model/geo/geoHelpers';

const W = 240, H = 220;

/** The state (or the seat's state for LS) with this seat lit in `color` and a soft glow. */
export function LocatorMap({ features, seat, label, color }: { features: GeoFeature[]; seat: GeoFeature | null; label: string; color: string }) {
  const glow = useId();
  const { paths, lit } = useMemo(() => {
    const fc = { type: 'FeatureCollection' as const, features };
    const proj = geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], fc);
    const path = geoPath(proj);
    return { paths: features.filter(f => f !== seat).map((f, i) => ({ key: i, d: path(f) ?? '' })), lit: seat ? path(seat) ?? '' : '' };
  }, [features, seat]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={label}>
      <defs>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {paths.map(p => <path key={p.key} d={p.d} className="fill-tile-raised stroke-line" strokeWidth={0.5} />)}
      {lit && <path d={lit} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={1.5} filter={`url(#${glow})`} />}
    </svg>
  );
}
