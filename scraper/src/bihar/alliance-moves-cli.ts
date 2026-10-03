/**
 * Write database/seed_manifest_alliances_v1.sql from scraper/data/alliance-moves-v1.json (parties the old manifests put
 * in the wrong alliance). Run-once and frozen once shipped: a later correction is a _v2 file.
 * Usage: npx ts-node src/bihar/alliance-moves-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { electionOf, parseState } from './elections';
import { emitAllianceMoves } from './manifest-fixes';

const rows: { state: string; year: number; party: string; from: string | null; to: string }[] =
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/alliance-moves-v1.json'), 'utf8'));
const moves = rows.map(r => ({ electionId: electionOf(parseState(r.state), r.year).electionId, party: r.party, from: r.from, to: r.to }));
fs.writeFileSync(path.resolve(__dirname, '../../../database/seed_manifest_alliances_v1.sql'), emitAllianceMoves('seed_manifest_alliances_v1', moves));
console.log(`Wrote seed_manifest_alliances_v1.sql (${moves.length} moves)`);
