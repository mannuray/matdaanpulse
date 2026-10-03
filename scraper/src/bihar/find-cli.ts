/** Find Bihar VS candidacies by name (curation helper). Usage: npx ts-node -T src/bihar/find-cli.ts "tejashwi yadav" ["nitish kumar" ...] */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { readExistingSeed } from './existing-seed';
import { similarity } from './names';
import type { ElectionJson } from './types';

const DB = path.resolve(__dirname, '../../../database');
const rows: { year: number; const_id: string; seat: string; name: string; party: string; votes: number; status: string }[] = [];
for (const y of [2010, 2015, 2020, 2025]) {
  const j: ElectionJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `vs-${y}.json`), 'utf8'));
  const seed = readExistingSeed(fs.readFileSync(path.join(DB, `seed_bihar_vs_${y}.sql`), 'utf8'));
  const byNo = new Map(seed.constituencies.map(k => [k.constNo, k]));
  for (const s of j.seats) for (const c of s.candidates) if (c.partyId !== 'NOTA') {
    const k = byNo.get(s.constNo)!;
    rows.push({ year: y, const_id: k.id, seat: k.name, name: c.name, party: c.partyId, votes: c.votes, status: c.status });
  }
}
for (const q of process.argv.slice(2)) {
  const qt = q.toUpperCase().split(/\s+/);
  const hits = rows.filter(r => similarity(r.name, q) >= 0.6 || qt.every(t => r.name.toUpperCase().includes(t)));
  console.log(`== ${q}`);
  for (const r of hits.sort((a, b) => a.year - b.year)) console.log(`  ${r.year}  ${r.const_id.padEnd(30)} ${r.name} (${r.party}) ${r.votes} ${r.status}`);
}
