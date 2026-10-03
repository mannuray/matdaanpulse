/**
 * Winners' affidavits from MyNeta → affidavits-<year>.json + the state's affidavits seed (seed_bihar_affidavits.sql /
 * seed_<slug>_affidavits.sql). Usage: npx ts-node src/bihar/affidavits-cli.ts [STATE]   (default BR; pages cached in data/raw/myneta/)
 */
import * as fs from 'fs';
import * as path from 'path';
import { electionOf, parseState } from './elections';
import { trackOf } from './current-track';
import { BIHAR_AFFIDAVITS } from './affidavits';
import { DB_DIR, loadSeeded } from './seeded';
import { MYNETA_SLUGS, emitAffidavitsSeed, matchWinners, parseWinners, winnersUrl, type Affidavit, type WinnerSeat } from './affidavits';
import type { Year } from './types';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const RAW = path.resolve(__dirname, '../../data/raw/myneta');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function page(slug: string): Promise<string> {
  const file = path.join(RAW, `${slug}-winners.html`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const r = await fetch(winnersUrl(slug), { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${winnersUrl(slug)}`);
  const html = await r.text();
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(file, html);
  await sleep(2000);
  return html;
}

(async () => {
  const ST = parseState(process.argv[2] ?? 'BR');
  const track = trackOf(ST);
  const slugOf = (y: number) => (ST === 'BR' ? MYNETA_SLUGS[y] : electionOf(ST, y).myneta!);
  const byYear: Record<string, Affidavit[]> = {};
  for (const y of track.years as Year[]) {
    const s = loadSeeded(ST, y);
    const seats: WinnerSeat[] = s.json.seats.map(seat => {
      const w = seat.candidates.find(c => c.status === 'WON')!;
      return { constNo: seat.constNo, name: s.seat(seat.constNo).name, winner: { candidateId: s.idOf(seat.constNo, w), name: w.name } };
    });
    const rows = parseWinners(await page(slugOf(y)), winnersUrl(slugOf(y)));
    const { matched, unmatched } = matchWinners(rows, seats);
    byYear[y] = matched;
    fs.writeFileSync(path.join(track.dir, `affidavits-${y}.json`), JSON.stringify({ source: winnersUrl(slugOf(y)), matched, unmatched }, null, 1) + '\n');
    console.log(`${y}: ${rows.length} MyNeta winners, ${matched.length} matched, ${unmatched.length} unmatched`);
    for (const u of unmatched) console.log(`    ${u}`);
  }
  const opts = ST === 'BR' ? BIHAR_AFFIDAVITS : { seedName: track.affidavitsSeed, label: `${track.state.name} VS ${track.years.join(', ')}` };
  fs.writeFileSync(path.join(DB_DIR, `${track.affidavitsSeed}.sql`), emitAffidavitsSeed(byYear, opts) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
