/**
 * Apply the reviewed Bihar 2025 party research: copy approved Commons images into frontend/public/symbols, delete
 * images found wrong, rewrite those parties' lines in database/seed_party_symbols.sql, and write
 * database/seed_bihar_party_profiles.sql. Rule (approved by the user): a new image replaces a current one only when
 * the current one is wrong or missing; a wrong current image with no replacement is removed.
 * Usage: npx ts-node src/bihar/party-profiles-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseState } from './elections';
import { latestYear, trackOf } from './current-track';
import { DB_DIR } from './seeded';
import { currentPath, emitPartyProfilesSeed, symbolsSeedLine, type ApprovedImages, type PartyProfile, type RemovedImages } from './party-profiles';

const RAW = path.resolve(__dirname, '../../data/raw/party-images');
const PUBLIC = path.resolve(__dirname, '../../../frontend/public');
const SYMBOLS_SEED = path.join(DB_DIR, 'seed_party_symbols.sql');

const ST = parseState(process.argv[2] ?? 'BR');
const track = trackOf(ST);
const year = latestYear(track);
const dataFile = path.join(track.dir, `parties-${year}.json`);
const profiles: PartyProfile[] = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
let seed = fs.readFileSync(SYMBOLS_SEED, 'utf8');
const current = (id: string, col: 'symbol_url' | 'eci_symbol_url') => currentPath(seed, id, col);

const approved: ApprovedImages = {};
const removed: RemovedImages = {};
for (const p of profiles) {
  const out: { logo?: string; eci?: string } = {};
  const place = (src: { file: string } , kind: 'logos' | 'eci') => {
    const served = `/symbols/${kind}/${p.id}${path.extname(src.file).toLowerCase()}`;
    fs.copyFileSync(path.join(RAW, src.file), path.join(PUBLIC, served));
    return served;
  };
  const drop = (served: string | null) => { if (served && fs.existsSync(path.join(PUBLIC, served))) fs.unlinkSync(path.join(PUBLIC, served)); };

  const curLogo = current(p.id, 'symbol_url'), curEci = current(p.id, 'eci_symbol_url');
  let logo = curLogo, eci = curEci;
  if (p.logo && (p.current_logo_ok === false || !curLogo)) { if (curLogo && p.current_logo_ok === false) drop(curLogo); logo = out.logo = place(p.logo, 'logos'); }
  else if (p.current_logo_ok === false && curLogo) { drop(curLogo); removed[p.id] = { ...removed[p.id], logo: curLogo }; logo = null; }
  if (p.eci_image && (p.current_eci_ok !== true || !curEci)) { if (curEci && p.current_eci_ok === false && curEci !== `/symbols/eci/${p.id}${path.extname(p.eci_image.file).toLowerCase()}`) drop(curEci); eci = out.eci = place(p.eci_image, 'eci'); }
  approved[p.id] = out;

  const line = symbolsSeedLine(p.id, logo, eci);
  const re = new RegExp(`^UPDATE parties SET .* WHERE id = '${p.id}';\\n`, 'm');
  seed = re.test(seed) ? seed.replace(re, line ? `${line}\n` : '') : line ? `${seed.trimEnd()}\n${line}\n` : seed;
  console.log(`${p.id.padEnd(6)} logo ${out.logo ? 'NEW' : removed[p.id]?.logo ? 'REMOVED' : logo ? 'kept' : 'none'}, eci ${out.eci ? 'NEW' : eci ? 'kept' : 'none'}`);
}
fs.writeFileSync(SYMBOLS_SEED, seed);
fs.writeFileSync(path.join(DB_DIR, `${track.partyProfilesSeed}.sql`), emitPartyProfilesSeed(profiles, approved, removed, track.partyProfilesOpts(year)) + '\n');
