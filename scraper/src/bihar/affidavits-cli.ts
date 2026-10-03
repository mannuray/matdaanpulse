/**
 * Winners' affidavits from MyNeta → affidavits-<year>.json + database/seed_bihar_affidavits.sql.
 * Usage: npx ts-node src/bihar/affidavits-cli.ts   (pages cached in data/raw/myneta/)
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
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
  const byYear: Record<string, Affidavit[]> = {};
  for (const y of [2010, 2015, 2020, 2025] as Year[]) {
    const s = loadSeeded('BR', y);
    const seats: WinnerSeat[] = s.json.seats.map(seat => {
      const w = seat.candidates.find(c => c.status === 'WON')!;
      return { constNo: seat.constNo, name: s.seat(seat.constNo).name, winner: { candidateId: s.idOf(seat.constNo, w), name: w.name } };
    });
    const rows = parseWinners(await page(MYNETA_SLUGS[y]), winnersUrl(MYNETA_SLUGS[y]));
    const { matched, unmatched } = matchWinners(rows, seats);
    byYear[y] = matched;
    fs.writeFileSync(path.join(DATA_DIR, `affidavits-${y}.json`), JSON.stringify({ source: winnersUrl(MYNETA_SLUGS[y]), matched, unmatched }, null, 1) + '\n');
    console.log(`${y}: ${rows.length} MyNeta winners, ${matched.length} matched, ${unmatched.length} unmatched`);
    for (const u of unmatched) console.log(`    ${u}`);
  }
  fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_affidavits.sql'), emitAffidavitsSeed(byYear) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
