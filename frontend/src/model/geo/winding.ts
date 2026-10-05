import { geoArea } from 'd3';

/**
 * d3-geo reads rings spherically: a polygon wound the planar (RFC 7946) way covers the whole globe except itself and
 * draws as a full-frame shape. Some map files are wound that way; each polygon whose area is more than a hemisphere has
 * its rings reversed. Correctly wound maps are returned unchanged.
 */
export function fixWinding(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const fixPolygon = (rings: GeoJSON.Position[][]) =>
    geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings;
  return {
    ...fc,
    features: fc.features.map(f => {
      const g = f.geometry;
      if (g?.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: fixPolygon(g.coordinates) } };
      if (g?.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixPolygon) } };
      return f;
    }),
  };
}
