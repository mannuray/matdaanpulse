import { describe, it, expect } from 'vitest';
import { geoArea } from 'd3';
import { fixWinding } from '../winding';

// A small square near Goa, counter-clockwise (planar RFC 7946 order: d3 reads it as the whole globe minus the square).
const ccw = [[74, 15], [74.1, 15], [74.1, 15.1], [74, 15.1], [74, 15]];
const cw = [...ccw].reverse();
const fc = (geometry: GeoJSON.Geometry): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] });

describe('fixWinding', () => {
  it('reverses the rings of a polygon d3 would read as (nearly) the whole sphere', () => {
    const out = fixWinding(fc({ type: 'Polygon', coordinates: [ccw] }));
    expect(geoArea(out.features[0])).toBeLessThan(0.001);
  });
  it('fixes each part of a multipolygon on its own and leaves correct ones alone', () => {
    const out = fixWinding(fc({ type: 'MultiPolygon', coordinates: [[ccw], [cw]] }));
    const g = out.features[0].geometry as GeoJSON.MultiPolygon;
    expect(g.coordinates[0][0]).toEqual(cw);
    expect(g.coordinates[1][0]).toEqual(cw);
  });
  it('keeps a correctly wound map as is', () => {
    const input = fc({ type: 'Polygon', coordinates: [cw] });
    expect(fixWinding(input).features[0].geometry).toEqual(input.features[0].geometry);
  });
});
