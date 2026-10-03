/**
 * Pure helpers for matching result regions (constituency ids from the API)
 * to GeoJSON features, and for deriving a constituency's state.
 *
 * Constituency id formats seen in the data:
 *   LS:  bare names             AGRA, AHMEDABAD_EAST, NEW_DELHI
 *   LS:  state-prefixed dupes   BR_AURANGABAD, MH_AURANGABAD, UP_HAMIRPUR
 *   VS:  state + era + number   WB_VS21_210_NANDIGRAM, BR_VS_12_NAME
 *
 * GeoJSON features carry `st_name` in display form ("Uttar Pradesh", "Delhi",
 * "Jammu & Kashmir", ...) and `pc_name` / `ac_name` (+ `ac_no` for VS).
 */
import { featureName, normName } from './geoHelpers';
import type { FeatureProperties } from './geoHelpers';

/** State code → `st_name` exactly as it appears in public/geo/india_pc_2008.geojson. */
export const STATE_CODE_TO_ST_NAME: Record<string, string> = {
  AN: 'Andaman & Nicobar', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh',
  AS: 'Assam', BR: 'Bihar', CH: 'Chandigarh', CG: 'Chhattisgarh',
  DD: 'Dadra and Nagar Haveli and Daman and Diu', DN: 'Dadra and Nagar Haveli and Daman and Diu',
  GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana', HP: 'Himachal Pradesh',
  JK: 'Jammu & Kashmir', JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala',
  LA: 'Ladakh', LD: 'Lakshadweep', MP: 'Madhya Pradesh', MH: 'Maharashtra',
  MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha',
  PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu',
  TS: 'Telangana', TG: 'Telangana', TR: 'Tripura', UP: 'Uttar Pradesh',
  UK: 'Uttarakhand', WB: 'West Bengal', DL: 'Delhi', PY: 'Puducherry',
};

/** Short display labels for long `st_name` values. */
const SHORT_STATE_LABELS: Record<string, string> = {
  'Dadra and Nagar Haveli and Daman and Diu': 'DNH & DD',
  'Andaman & Nicobar': 'A&N Islands',
};

export function displayStateName(stName: string): string {
  return SHORT_STATE_LABELS[stName] || stName;
}

export interface ParsedConstId {
  /** Known 2-letter state code prefix, if present. */
  stateCode?: string;
  /** Assembly constituency number (VS ids), if present. */
  constNo?: string;
  /** Normalized name portion (A-Z0-9 only). */
  nameNorm: string;
}

/**
 * Parse a constituency id. A leading `XX_` is treated as a state prefix only
 * when XX is a known state code — bare LS names such as `NEW_DELHI`,
 * `RAJ_NANDGAON` or `DUM_DUM` must not be split.
 */
export function parseConstId(id: string): ParsedConstId {
  const upper = id.toUpperCase();
  const m = upper.match(/^([A-Z]{2})_(.+)$/);
  if (!m || !STATE_CODE_TO_ST_NAME[m[1]]) return { nameNorm: normName(upper) };
  let rest = m[2].replace(/^VS\d*_/, '');
  let constNo: string | undefined;
  const num = rest.match(/^(\d+)_(.+)$/);
  if (num) { constNo = num[1]; rest = num[2]; }
  return { stateCode: m[1], constNo, nameNorm: normName(rest) };
}

/** State `st_name` implied by the id prefix (e.g. `BR_AURANGABAD` → Bihar). */
export function stateFromConstId(id: string): string | undefined {
  const { stateCode } = parseConstId(id);
  return stateCode ? STATE_CODE_TO_ST_NAME[stateCode] : undefined;
}

interface RegionLike { id: string; name?: string }

/**
 * Lookup keyed by several normalized forms of each region. Keys:
 *   `ST:<normState>:<normName>`  (state-qualified; only for prefixed ids)
 *   `NO:<constNo>:<normName>`    (VS const_no + name)
 *   `NM:<normName>`              (bare name; last writer wins on collisions,
 *                                 which is why the qualified keys are tried first)
 */
export function buildRegionLookup<R extends RegionLike>(regions: R[]): Map<string, R> {
  const lookup = new Map<string, R>();
  for (const r of regions) {
    const parsed = parseConstId(r.id);
    const fullNorm = normName(r.id);
    if (!lookup.has(`NM:${fullNorm}`)) lookup.set(`NM:${fullNorm}`, r);
    if (r.name) {
      const n = normName(r.name);
      if (!lookup.has(`NM:${n}`)) lookup.set(`NM:${n}`, r);
    }
    if (parsed.stateCode) {
      const st = normName(STATE_CODE_TO_ST_NAME[parsed.stateCode]);
      lookup.set(`ST:${st}:${parsed.nameNorm}`, r);
      if (parsed.constNo) lookup.set(`NO:${parsed.constNo}:${parsed.nameNorm}`, r);
      if (!lookup.has(`NM:${parsed.nameNorm}`)) lookup.set(`NM:${parsed.nameNorm}`, r);
    }
  }
  return lookup;
}

/** Find the region matching a GeoJSON feature using a lookup from {@link buildRegionLookup}. */
export function findRegionForFeature<R>(lookup: Map<string, R>, props: FeatureProperties): R | undefined {
  const nameNorm = normName(featureName(props));
  const stNorm = normName(props.st_name || '');
  if (props.ac_no) {
    const byNo = lookup.get(`NO:${props.ac_no}:${nameNorm}`);
    if (byNo) return byNo;
  }
  return lookup.get(`ST:${stNorm}:${nameNorm}`) || lookup.get(`NM:${nameNorm}`);
}

/**
 * Map each constituency id to its `st_name`.
 * Uses the id's state prefix when present; otherwise resolves via the
 * GeoJSON feature whose normalized name matches uniquely.
 */
export function buildStateByConstId(
  constIds: Iterable<string>,
  features: { properties: FeatureProperties }[],
): Map<string, string> {
  const statesByName = new Map<string, Set<string>>();
  for (const f of features) {
    const n = normName(featureName(f.properties));
    if (!n || !f.properties.st_name) continue;
    let set = statesByName.get(n);
    if (!set) statesByName.set(n, (set = new Set()));
    set.add(f.properties.st_name);
  }
  const out = new Map<string, string>();
  for (const id of constIds) {
    const fromPrefix = stateFromConstId(id);
    if (fromPrefix) { out.set(id, fromPrefix); continue; }
    const candidates = statesByName.get(parseConstId(id).nameNorm);
    if (candidates && candidates.size === 1) out.set(id, [...candidates][0]);
  }
  return out;
}

/**
 * Group regions by the `st_name` of their matched feature in a single pass
 * over the features (O(features)), for the States mini-map view.
 */
export function groupRegionsByState<R>(
  lookup: Map<string, R>,
  features: { properties: FeatureProperties }[],
): Map<string, R[]> {
  const out = new Map<string, R[]>();
  const seen = new Set<R>();
  for (const f of features) {
    const r = findRegionForFeature(lookup, f.properties);
    if (!r || seen.has(r)) continue;
    seen.add(r);
    const st = f.properties.st_name;
    const arr = out.get(st);
    if (arr) arr.push(r); else out.set(st, [r]);
  }
  return out;
}

/**
 * Human-readable constituency name from its id:
 *   AHMEDABAD_EAST → "Ahmedabad East", BR_AURANGABAD → "Aurangabad",
 *   WB_VS21_210_NANDIGRAM → "Nandigram".
 */
export function displayNameFromConstId(id: string): string {
  let rest = id;
  const m = id.toUpperCase().match(/^([A-Z]{2})_(.+)$/);
  if (m && STATE_CODE_TO_ST_NAME[m[1]]) {
    rest = id.slice(3).replace(/^VS\d*_/i, '').replace(/^\d+_/, '');
  }
  return rest
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
