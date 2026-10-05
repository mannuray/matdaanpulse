import { buildRegionLookup, findRegionForFeature, parseConstId } from './regionMatching';
import type { GeoFeature } from './geoHelpers';

/**
 * Feature → seat id, using the same matcher as the legacy map (number+name, then state+name, then name).
 * `byNumber` (Vidhan Sabha maps, one state each, so the number is unique): a numbered feature takes the seat with its
 * `ac_no`, whatever its name says (map spellings differ from ECI's, and some features carry a neighbour's name); names are
 * used only for features without a number or seats whose ids carry none.
 */
export function matchFeaturesToSeats<S extends { id: string; name: string; state?: string }>(features: GeoFeature[], seats: S[], opts: { byNumber?: boolean } = {}): Map<GeoFeature, string> {
  const lookup = buildRegionLookup(seats);
  const byNo = new Map<string, S>();
  if (opts.byNumber) for (const s of seats) { const no = parseConstId(s.id).constNo; if (no) byNo.set(String(Number(no)), s); }
  const out = new Map<GeoFeature, string>();
  for (const feat of features) {
    const no = feat.properties.ac_no;
    const seat = byNo.size && no ? byNo.get(String(Number(no))) : findRegionForFeature(lookup, feat.properties);
    if (seat) out.set(feat, seat.id);
  }
  return out;
}
