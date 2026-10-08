#!/usr/bin/env node
/**
 * Shrinks map files in place WITHOUT changing their format, file names, features, properties or boundaries: it only
 * rounds coordinates (and drops points that became consecutive duplicates). Same boundary set, re-encoded — not a
 * redraw (a redraw still gets a new <code>_ac_<era>.geojson file, CLAUDE.md).
 *
 * Precision follows the map's extent: the rounding step is at most extent / STEPS (STEPS = 20 000, i.e. under one
 * pixel on an 800 px wide map zoomed 25x), e.g. 4 decimals (~11 m) for Uttar Pradesh, 5 for Delhi. Shared borders
 * round to identical values, so no gaps or slivers appear between seats.
 *
 * Every file is checked against its input before it is written (nothing is written if a check fails):
 *   same top-level keys, feature count, properties (deep-equal, same key order), geometry types (also inside
 *   GeometryCollections), polygon and ring
 *   counts; every point moved by at most half a step; every polygon keeps its spherical winding class (d3 reads a
 *   polygon over a hemisphere as "the globe minus the shape") and its area within 1% (absolute slack for tiny ones).
 *
 * usage: node scripts/compact-geojson.mjs [--dry-run] public/geo/*.geojson
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoArea } from 'd3-geo';

const STEPS = 20_000;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) { console.error('usage: node scripts/compact-geojson.mjs [--dry-run] <file.geojson>...'); process.exit(2); }

/** Every polygon of a geometry, in order (GeometryCollections included). Other geometry types are left alone. */
const polygonsOf = g => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates
  : g?.type === 'GeometryCollection' ? g.geometries.flatMap(polygonsOf) : []);
const typesOf = g => (g?.type === 'GeometryCollection' ? `GC(${g.geometries.map(typesOf).join(',')})` : String(g?.type));

function extentOf(fc) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of fc.features) for (const poly of polygonsOf(f.geometry)) for (const ring of poly) for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return Math.max(x1 - x0, y1 - y0);
}

function compactRing(ring, f) {
  const r = p => [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f, ...p.slice(2)];
  const rounded = ring.map(r);
  const out = [];
  for (const p of rounded) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  const closed = out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1];
  if (!closed) out.push(out[0]);
  // A ring that collapses (a tiny island) keeps its input points: it must stay a valid ring.
  return out.length >= 4 ? out : ring;
}

function compactGeometry(g, f) {
  if (g?.type === 'Polygon') return { ...g, coordinates: g.coordinates.map(ring => compactRing(ring, f)) };
  if (g?.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(poly => poly.map(ring => compactRing(ring, f))) };
  if (g?.type === 'GeometryCollection') return { ...g, geometries: g.geometries.map(x => compactGeometry(x, f)) };
  return g;
}

function check(before, after, decimals) {
  const step = 10 ** -decimals, f = 10 ** decimals;
  const fail = msg => { throw new Error(msg); };
  if (JSON.stringify(Object.keys(before)) !== JSON.stringify(Object.keys(after))) fail('top-level keys differ');
  if (before.features.length !== after.features.length) fail('feature count differs');
  let worstMove = 0, worstArea = 0;
  before.features.forEach((fb, i) => {
    const fa = after.features[i];
    if (JSON.stringify(fb.properties) !== JSON.stringify(fa.properties)) fail(`feature ${i}: properties differ`);
    if (JSON.stringify(Object.keys(fb)) !== JSON.stringify(Object.keys(fa))) fail(`feature ${i}: keys differ`);
    if (typesOf(fb.geometry) !== typesOf(fa.geometry)) fail(`feature ${i}: geometry types differ`);
    const pb = polygonsOf(fb.geometry), pa = polygonsOf(fa.geometry);
    if (pb.length !== pa.length) fail(`feature ${i}: polygon count differs`);
    pb.forEach((polyB, j) => {
      const polyA = pa[j];
      if (polyB.length !== polyA.length) fail(`feature ${i}.${j}: ring count differs`);
      polyB.forEach((ringB, k) => {
        const ringA = polyA[k];
        if (ringA === ringB) return;
        // Every input point is within half a step of a kept point (its own rounding, or the duplicate kept for it).
        const kept = new Set(ringA.map(p => `${p[0]},${p[1]}`));
        for (const p of ringB) {
          const q = [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
          if (!kept.has(`${q[0]},${q[1]}`)) fail(`feature ${i}.${j}.${k}: point ${p} lost`);
          worstMove = Math.max(worstMove, Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
        }
      });
      const ab = geoArea({ type: 'Polygon', coordinates: polyB }), aa = geoArea({ type: 'Polygon', coordinates: polyA });
      if ((ab > 2 * Math.PI) !== (aa > 2 * Math.PI)) fail(`feature ${i}.${j}: winding class flipped`);
      const sb = Math.min(ab, 4 * Math.PI - ab), sa = Math.min(aa, 4 * Math.PI - aa);
      // Absolute slack: a ring of n points moved by step/2 changes the area by at most ~n * step * perimeter-ish; use
      // (10 steps)^2 in steradians, so a polygon a few steps wide is not held to 1%.
      const slack = (10 * step * Math.PI / 180) ** 2;
      const rel = Math.abs(sa - sb) / Math.max(sb, 1e-30);
      if (Math.abs(sa - sb) > slack && rel > 0.01) fail(`feature ${i}.${j}: area changed by ${(rel * 100).toFixed(2)}%`);
      if (Math.abs(sa - sb) > slack) worstArea = Math.max(worstArea, rel);
    });
  });
  if (worstMove > step / 2 + 1e-12) fail(`a point moved ${worstMove} > step/2`);
  return { worstMove, worstArea };
}

let totalBefore = 0, totalAfter = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const before = JSON.parse(text);
  const extent = extentOf(before);
  const decimals = Math.min(6, Math.max(3, Math.ceil(Math.log10(STEPS / extent))));
  const after = { ...before, features: before.features.map(f => ({ ...f, geometry: compactGeometry(f.geometry, 10 ** decimals) })) };
  const out = JSON.stringify(after);
  const { worstArea } = check(before, JSON.parse(out), decimals);
  totalBefore += text.length; totalAfter += out.length;
  const pct = (100 * (1 - out.length / text.length)).toFixed(1);
  console.log(`${file}: ${text.length} -> ${out.length} bytes (-${pct}%), ${decimals} decimals, ${before.features.length} features, worst area change ${(worstArea * 100).toFixed(3)}%`);
  if (!dryRun && out.length < text.length) writeFileSync(file, out);
}
console.log(`total: ${totalBefore} -> ${totalAfter} bytes (-${(100 * (1 - totalAfter / totalBefore)).toFixed(1)}%)${dryRun ? ' (dry run)' : ''}`);
