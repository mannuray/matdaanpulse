import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  STATE_CODE_TO_ST_NAME, parseConstId, stateFromConstId, buildRegionLookup,
  findRegionForFeature, buildStateByConstId, groupRegionsByState, displayNameFromConstId,
} from '../utils/regionMatching';
import type { FeatureProperties } from '../utils/geoHelpers';

const geo = JSON.parse(readFileSync(resolve(__dirname, '../../public/geo/india_pc.geojson'), 'utf8')) as {
  features: { properties: FeatureProperties }[];
};
const features = geo.features;

// Mirrors the seed's id scheme: bare upper-snake names, state-prefixed only for duplicate names.
const PREFIXED: Record<string, string> = {
  'Bihar:AURANGABAD': 'BR_AURANGABAD', 'Maharashtra:AURANGABAD': 'MH_AURANGABAD',
  'Uttar Pradesh:HAMIRPUR': 'UP_HAMIRPUR', 'Himachal Pradesh:HAMIRPUR': 'HP_HAMIRPUR',
  'Bihar:MAHARAJGANJ': 'BR_MAHARAJGANJ', 'Uttar Pradesh:MAHARAJGANJ': 'UP_MAHARAJGANJ',
};
function seedLikeId(p: FeatureProperties): string {
  const bare = (p.pc_name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return PREFIXED[`${p.st_name}:${bare}`] || bare;
}
const regions = features.map(f => ({ id: seedLikeId(f.properties), name: displayNameFromConstId(seedLikeId(f.properties)) }));

describe('parseConstId / stateFromConstId', () => {
  it('only treats known 2-letter state codes as prefixes', () => {
    expect(parseConstId('NEW_DELHI')).toEqual({ nameNorm: 'NEWDELHI' });
    expect(parseConstId('DUM_DUM').stateCode).toBeUndefined();
    expect(parseConstId('BR_AURANGABAD')).toMatchObject({ stateCode: 'BR', nameNorm: 'AURANGABAD' });
    expect(parseConstId('WB_VS21_210_NANDIGRAM')).toEqual({ stateCode: 'WB', constNo: '210', nameNorm: 'NANDIGRAM' });
  });

  it('maps prefixes to geojson st_name values', () => {
    expect(stateFromConstId('MH_AURANGABAD')).toBe('Maharashtra');
    expect(stateFromConstId('AGRA')).toBeUndefined();
  });

  it('every STATE_CODE_TO_ST_NAME value exists in the geojson', () => {
    const stNames = new Set(features.map(f => f.properties.st_name));
    for (const v of Object.values(STATE_CODE_TO_ST_NAME)) expect(stNames).toContain(v);
  });
});

describe('region ↔ feature matching', () => {
  it('resolves all 543 LS features to a unique region', () => {
    expect(features).toHaveLength(543);
    const lookup = buildRegionLookup(regions);
    const matched = features.map(f => findRegionForFeature(lookup, f.properties));
    expect(matched.every(Boolean)).toBe(true);
    expect(new Set(matched.map(r => r!.id)).size).toBe(543);
  });

  it('disambiguates duplicate names by state', () => {
    const lookup = buildRegionLookup(regions);
    const mh = features.find(f => f.properties.st_name === 'Maharashtra' && /aurangabad/i.test(f.properties.pc_name || ''))!;
    expect(findRegionForFeature(lookup, mh.properties)?.id).toBe('MH_AURANGABAD');
  });

  it('matches regions whose display name differs in case from the feature name', () => {
    const lookup = buildRegionLookup([{ id: 'AGRA', name: 'AGRA' }]);
    expect(findRegionForFeature(lookup, { pc_name: 'Agra', st_name: 'Uttar Pradesh' })?.id).toBe('AGRA');
  });

  it('groups regions per state in one pass', () => {
    const byState = groupRegionsByState(buildRegionLookup(regions), features);
    expect(byState.get('Uttar Pradesh')).toHaveLength(80);
    expect(byState.get('Delhi')).toHaveLength(7);
  });
});

describe('buildStateByConstId', () => {
  it('derives states for bare LS ids and prefixed duplicates', () => {
    const m = buildStateByConstId(['AGRA', 'AHMEDABAD_EAST', 'BR_AURANGABAD', 'CHANDNI_CHOWK', 'AURANGABAD'], features);
    expect(m.get('AGRA')).toBe('Uttar Pradesh');
    expect(m.get('AHMEDABAD_EAST')).toBe('Gujarat');
    expect(m.get('BR_AURANGABAD')).toBe('Bihar');
    expect(m.get('CHANDNI_CHOWK')).toBe('Delhi');
    // Ambiguous bare name (exists in two states) stays unresolved rather than guessing.
    expect(m.has('AURANGABAD')).toBe(false);
  });

  it('resolves every seed-like id', () => {
    const m = buildStateByConstId(regions.map(r => r.id), features);
    expect(m.size).toBe(543);
  });
});

describe('displayNameFromConstId', () => {
  it('produces readable names', () => {
    expect(displayNameFromConstId('AHMEDABAD_EAST')).toBe('Ahmedabad East');
    expect(displayNameFromConstId('BR_AURANGABAD')).toBe('Aurangabad');
    expect(displayNameFromConstId('WB_VS21_210_NANDIGRAM')).toBe('Nandigram');
    expect(displayNameFromConstId('NEW_DELHI')).toBe('New Delhi');
  });
});
