import { buildRegionLookup, findRegionForFeature, parseConstId } from './regionMatching';
import type { GeoFeature } from './geoHelpers';

/**
 * Feature → seat id, using the same matcher as the legacy map (number+name, then state+name, then name).
 * `byNumber` (Vidhan Sabha maps, one state each, so the number is unique): a feature whose name matches no seat takes the
 * seat with its `ac_no` (map spellings differ from ECI's).
 */
export function matchFeaturesToSeats<S extends { id: string; name: string; state?: string }>(features: GeoFeature[], seats: S[], opts: { byNumber?: boolean } = {}): Map<GeoFeature, string> {
  const lookup = buildRegionLookup(seats);
  const byNo = new Map<string, S>();
  if (opts.byNumber) for (const s of seats) { const no = parseConstId(s.id).constNo; if (no) byNo.set(String(Number(no)), s); }
  const out = new Map<GeoFeature, string>();
  for (const feat of features) {
    const seat = findRegionForFeature(lookup, feat.properties) ?? (feat.properties.ac_no ? byNo.get(String(Number(feat.properties.ac_no))) : undefined);
    if (seat) out.set(feat, seat.id);
  }
  return out;
}
