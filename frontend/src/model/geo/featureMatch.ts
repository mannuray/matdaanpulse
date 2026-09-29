import { buildRegionLookup, findRegionForFeature } from './regionMatching';
import type { GeoFeature } from './geoHelpers';

/** Feature → seat id, using the same matcher as the legacy map (number+name, then state+name, then name). */
export function matchFeaturesToSeats<S extends { id: string; name: string; state?: string }>(features: GeoFeature[], seats: S[]): Map<GeoFeature, string> {
  const lookup = buildRegionLookup(seats);
  const out = new Map<GeoFeature, string>();
  for (const feat of features) {
    const seat = findRegionForFeature(lookup, feat.properties);
    if (seat) out.set(feat, seat.id);
  }
  return out;
}
