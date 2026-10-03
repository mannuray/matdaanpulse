/**
 * ECI 2026 boundary files → maps. Assam: writes frontend/public/geo/as_ac_2023.geojson (normalised, simplified with
 * mapshaper). The other states keep their 2008 maps; their ECI 2026 files are only checked for the seat numbering.
 * Usage: npx ts-node src/bihar/geo-cli.ts <STATE> [simplify %, default 8]
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { STATES, electionOf, parseState } from './elections';
import { rawDir, dataDir } from './load';
import { normaliseFeatures, numberingMismatches, parseEciAcJs, rewindForD3 } from './geo';
import { readExistingSeed } from './existing-seed';
import type { ElectionJson } from './types';

const ST = parseState(process.argv[2]);
const pct = process.argv[3] ?? '8';
const cfg = electionOf(ST, 2026);
const ROOT = path.resolve(__dirname, '../../..');

(async () => {
  const file = path.join(rawDir(ST), '2026', 'ac.js');
  if (!fs.existsSync(file)) {
    const url = `${cfg.resultsSite!.base}ac/${cfg.resultsSite!.eciCode}.js`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) matdaanpulse-seed' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
  const fc = parseEciAcJs(fs.readFileSync(file, 'utf8'));
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(dataDir(ST), 'vs-2026.json'), 'utf8'));
  if (cfg.newElection?.delimitation !== '2008') {
    const seats = Object.fromEntries(json.seats.map(s => [s.constNo, { type: s.type, name: s.name! }]));
    const tmp = path.join(rawDir(ST), '2026', 'ac-normalised.geojson');
    fs.writeFileSync(tmp, JSON.stringify(normaliseFeatures(fc, STATES[ST].name.toUpperCase(), seats)));
    const out = path.join(ROOT, 'frontend/public/geo', `${ST.toLowerCase()}_ac_${cfg.newElection!.delimitation}.geojson`);
    execFileSync('npx', ['mapshaper', tmp, '-simplify', `${pct}%`, 'keep-shapes', '-o', 'precision=0.0001', 'format=geojson', out], { stdio: 'inherit' });
    fs.writeFileSync(out, JSON.stringify(rewindForD3(JSON.parse(fs.readFileSync(out, 'utf8')))));
    console.log(`${path.relative(ROOT, out)}: ${fc.features.length} seats, ${Math.round(fs.statSync(out).size / 1024)} KB`);
  } else {
    const seed = readExistingSeed(fs.readFileSync(path.join(ROOT, 'database', STATES[ST].yearSeed(2021)), 'utf8'));
    const names = Object.fromEntries(seed.constituencies.map(c => [c.constNo, c.name]));
    const bad = numberingMismatches(fc, names);
    console.log(`${STATES[ST].name}: ${fc.features.length} ECI 2026 seats, ${bad.length} numbering mismatches vs 2021${bad.length ? ':\n  ' + bad.join('\n  ') : ''}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
