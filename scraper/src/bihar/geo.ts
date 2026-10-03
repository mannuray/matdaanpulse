/** ECI results-site boundary files (`ac/<code>.js`: `var json_All_AC = <GeoJSON>`) → our map properties. */
import { similarity } from './names';

export interface Feature { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }
export interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }

export function parseEciAcJs(js: string): FeatureCollection {
  const start = js.indexOf('{');
  if (start < 0) throw new Error('no GeoJSON object in the file');
  return JSON.parse(js.slice(start).trim().replace(/;$/, ''));
}

/**
 * Our map properties (as in as_ac_2008.geojson): ac_no, ac_name, ac_category, st_name. The name is our seat's name, upper
 * case: the frontend joins features to seats by number + name, and ECI's names carry "(SC)"/"(ST)" and other spellings.
 */
export function normaliseFeatures(fc: FeatureCollection, stName: string, seats: Record<number, { type: 'GEN' | 'SC' | 'ST'; name: string }>): FeatureCollection {
  return { type: 'FeatureCollection', features: fc.features.map(f => {
    const no = Number(f.properties.AC_NO);
    if (!seats[no]) throw new Error(`AC ${no} has no seat type`);
    return { type: 'Feature', properties: { ac_no: no, ac_name: seats[no].name.toUpperCase(), ac_category: seats[no].type, st_name: stName }, geometry: f.geometry };
  }) };
}

/** Seats whose ECI name is unlike our name for the same number (a renumbering would show here). */
export function numberingMismatches(fc: FeatureCollection, names: Record<number, string>): string[] {
  return fc.features.flatMap(f => {
    const no = Number(f.properties.AC_NO), eci = String(f.properties.AC_NAME), ours = names[no];
    return ours !== undefined && similarity(eci.toUpperCase(), ours.toUpperCase()) < 0.6 ? [`${no}: ECI "${eci}" vs ours "${ours}"`] : [];
  });
}

type Ring = number[][];
const signedArea = (r: Ring) => r.slice(0, -1).reduce((a, p, i) => a + p[0] * r[i + 1][1] - r[i + 1][0] * p[1], 0) / 2;
/** Outer ring clockwise (negative planar area), holes counter-clockwise: d3-geo's winding, as in our 2008 maps. */
const rewindPolygon = (rings: Ring[]): Ring[] => rings.map((r, i) => ((i === 0) === (signedArea(r) > 0) ? [...r].reverse() : r));

/** mapshaper writes RFC 7946 (counter-clockwise) rings; d3 would then draw each seat as the whole globe minus the seat. */
export function rewindForD3(fc: FeatureCollection): FeatureCollection {
  return { type: 'FeatureCollection', features: fc.features.map(f => {
    const g = f.geometry as { type: string; coordinates: unknown };
    const coordinates = g.type === 'Polygon' ? rewindPolygon(g.coordinates as Ring[])
      : g.type === 'MultiPolygon' ? (g.coordinates as Ring[][]).map(rewindPolygon) : g.coordinates;
    return { ...f, geometry: { ...g, coordinates } };
  }) };
}
