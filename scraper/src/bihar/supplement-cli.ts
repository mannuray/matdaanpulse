/**
 * Fill seats a statistical report publishes without votes from the archived official ECI results pages.
 * Usage: npx ts-node src/bihar/supplement-cli.ts <year> <from YYYYMMDD> <to YYYYMMDD> <constNo> [constNo ...]
 *   e.g. npx ts-node src/bihar/supplement-cli.ts 2015 20151108 20160630 195 210 229
 * Picks the latest Wayback snapshot (HTTP 200) of eciresults.nic.in/ConstituencywiseS04<n>.htm in the window.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { parseEciResultsHtml, type Supplement } from './supplement';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const get = async (url: string) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };

(async () => {
  const [year, from, to, ...seats] = process.argv.slice(2);
  if (!year || !from || !to || !seats.length) throw new Error('usage: supplement-cli.ts <year> <from> <to> <constNo...>');
  const file = path.join(DATA_DIR, 'supplement.json');
  const sup: Supplement = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const list = (sup[year] ?? []).filter(s => !seats.includes(String(s.constNo)));
  for (const n of seats) {
    const cdx = await get(`https://web.archive.org/cdx/search/cdx?url=eciresults.nic.in/ConstituencywiseS04${n}.htm&matchType=prefix&from=${from}&to=${to}&filter=statuscode:200&output=json`);
    const rows = (JSON.parse(cdx) as string[][]).slice(1);
    if (!rows.length) throw new Error(`no snapshot for seat ${n} in ${from}-${to}`);
    const [, ts, original] = rows[rows.length - 1];
    const source = `https://web.archive.org/web/${ts}/${original}`;
    await sleep(2000);
    const candidates = parseEciResultsHtml(await get(`https://web.archive.org/web/${ts}id_/${original}`));
    list.push({ constNo: Number(n), source, candidates });
    console.log(`seat ${n}: ${candidates.length} rows from ${source}`);
    await sleep(2000);
  }
  sup[year] = list.sort((a, b) => a.constNo - b.constNo);
  fs.writeFileSync(file, JSON.stringify(sup, null, 1) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
