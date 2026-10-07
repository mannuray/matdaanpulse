import { describe, expect, it } from 'vitest';
import { normaliseFeatures, numberingMismatches, parseEciAcJs, rewindForD3 } from '../geo';

const js = 'var json_All_AC ={ "type": "FeatureCollection", "name": "AC-Boundary", "features": [' +
  '{"type":"Feature","properties":{"AC_NO":33,"AC_NAME":"DISPUR","FID":1,"ST_CODE":"S03","ST_NAME":"ASSAM"},"geometry":{"type":"Polygon","coordinates":[[[91,26],[91.1,26],[91.1,26.1],[91,26]]]}}] }';

describe('parseEciAcJs', () => {
  it('reads the GeoJSON out of ECI\'s JS variable', () => {
    expect(parseEciAcJs(js).features[0].properties).toMatchObject({ AC_NO: 33, AC_NAME: 'DISPUR' });
  });
});
describe('normaliseFeatures', () => {
  it('keeps only our property names, with our seat name and type (the frontend joins features to seats by number + name)', () => {
    const fc = parseEciAcJs(js.replace('"DISPUR"', '"DISPUR (SC)"'));
    expect(normaliseFeatures(fc, 'ASSAM', { 33: { type: 'SC', name: 'Dispur' } }).features[0].properties).toEqual({ ac_no: 33, ac_name: 'DISPUR', ac_category: 'SC', st_name: 'ASSAM' });
  });
  it('fails on a seat missing from the results (a numbering mismatch)', () => {
    expect(() => normaliseFeatures(parseEciAcJs(js), 'ASSAM', {})).toThrow(/AC 33 has no seat type/);
  });
  it('keeps ECI\'s unnumbered areas (AC 0, "NA": land with no seat) as unnamed shapes, as the older maps do', () => {
    const fc = parseEciAcJs(js.replace('"AC_NO":33,"AC_NAME":"DISPUR"', '"AC_NO":0,"AC_NAME":"NA"'));
    expect(normaliseFeatures(fc, 'JAMMU AND KASHMIR', {}).features[0].properties).toEqual({ ac_no: 0, ac_name: '', ac_category: 'GEN', st_name: 'JAMMU AND KASHMIR' });
  });
});
describe('numberingMismatches', () => {
  it('flags a seat whose ECI 2026 name is unlike our name for that number', () => {
    const fc = parseEciAcJs(js);
    expect(numberingMismatches(fc, { 33: 'Dispur' })).toEqual([]);
    expect(numberingMismatches(fc, { 33: 'Jalukbari' })).toEqual(['33: ECI "DISPUR" vs ours "Jalukbari"']);
  });
});

describe('rewindForD3', () => {
  const area = (r: number[][]) => r.slice(0, -1).reduce((a, p, i) => a + p[0] * r[i + 1][1] - r[i + 1][0] * p[1], 0) / 2;
  it('makes outer rings clockwise and holes counter-clockwise (what our 2008 maps and d3 use)', () => {
    const ccw = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    const hole = [[0.2, 0.2], [0.2, 0.8], [0.8, 0.8], [0.8, 0.2], [0.2, 0.2]];
    const fc = { type: 'FeatureCollection' as const, features: [
      { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon', coordinates: [ccw, hole] } },
      { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[ccw]] } }] };
    const out = rewindForD3(fc);
    const [outer, inner] = (out.features[0].geometry as { coordinates: number[][][] }).coordinates;
    expect(area(outer)).toBeLessThan(0);
    expect(area(inner)).toBeGreaterThan(0);
    expect(area((out.features[1].geometry as { coordinates: number[][][][] }).coordinates[0][0])).toBeLessThan(0);
  });
});
