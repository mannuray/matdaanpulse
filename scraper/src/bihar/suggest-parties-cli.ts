/** Propose party-map.json entries for every party in a state's party lists. Usage: npx ts-node src/bihar/suggest-parties-cli.ts <STATE> [years] */
import * as fs from 'fs';
import { Client } from 'pg';
import { suggestEntries, type DbParty } from './party-map';
import { loadPartyLists, PARTY_DIR } from './load';
import { parseState } from './elections';
import type { PartyMap } from './types';

async function main() {
  const ST = parseState(process.argv[2]);
  const file = `${PARTY_DIR}/party-map.json`;
  const map: PartyMap = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://admin:password123@localhost:3083/election_tracker' });
  await db.connect();
  const rows = (await db.query<DbParty>(`SELECT p.id, p.name, p.abbreviation, p.color, p.eci_recognition AS recognition,
    (SELECT count(*)::int FROM candidates c WHERE c.party_id = p.id) AS candidates FROM parties p ORDER BY p.id`)).rows;
  await db.end();
  const lists = await loadPartyLists(ST, process.argv.slice(3).map(Number));
  const used = lists.filter(p => p.used); // only parties that fielded a candidate in this state
  const { add, problems, notes, aliases } = suggestEntries(used, rows, map, ST);
  const aliasFile = `${PARTY_DIR}/party-aliases.json`;
  const oldAliases: Record<string, string> = fs.existsSync(aliasFile) ? JSON.parse(fs.readFileSync(aliasFile, 'utf8')) : {};
  fs.writeFileSync(aliasFile, JSON.stringify({ ...oldAliases, ...aliases }, null, 2) + '\n');
  const merged = Object.fromEntries(Object.entries({ ...map, ...add }).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
  console.log(`party-map.json: ${Object.keys(add).length} added, ${Object.keys(merged).length} total`);
  for (const n of notes) console.log(`  note: ${n}`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
