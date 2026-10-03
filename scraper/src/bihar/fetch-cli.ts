/**
 * Download the ECI statistical reports used for Bihar seeding into scraper/data/raw/bihar/<year>/.
 * Usage: npx ts-node src/bihar/fetch-cli.ts <STATE> [year ...]   (skips files that already exist)
 */
import * as fs from 'fs';
import * as path from 'path';
import { rawDir } from './load';
import { STATES, electionsOf, parseState, type StateCode } from './elections';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const BASE = 'https://www.eci.gov.in/eci-backend/public';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const get = async (url: string) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; };

let ST: StateCode = 'BR';
async function save(year: string, name: string, url: string) {
  const out = path.join(rawDir(ST), year, name);
  if (fs.existsSync(out)) { console.log(`  have ${year}/${name}`); return; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // ECI's download endpoint sometimes answers 500; retry, then skip the file (a missing report shows up when parsing).
  for (let i = 1; ; i++) {
    try { fs.writeFileSync(out, Buffer.from(await (await get(url)).arrayBuffer())); break; }
    catch (e) { if (i >= 3) { console.warn(`  FAILED ${year}/${name}: ${(e as Error).message.slice(0, 60)}`); return; } await sleep(5000 * i); }
  }
  console.log(`  saved ${year}/${name}`);
  await sleep(2000);
}

/** 2025: new-site report list (each item has title + xlsx_url). Saved without ECI's timestamp suffix. */
async function fetchNew(year: string, categoryId: number) {
  const body = await (await get(`${BASE}/api/election-result?category_id=${categoryId}`)).json() as { results: { title: string; xlsx_url: string | null }[] };
  for (const r of body.results) if (r.xlsx_url) await save(year, path.basename(r.xlsx_url).replace(/_\d{9,}(\.\w+)$/, '$1'), r.xlsx_url.replace('public//', 'public/'));
}

/** Older years: old-site report attachments (download links are opaque /api/download?url=… values). */
async function fetchOld(year: string, docid: number) {
  const body = await (await get(`${BASE}/api/old-site-statistical-report-data?docid=${docid}`)).json() as
    { results: { data: { document_attach: { record_realname: string; record_location: string }[] }[] } };
  for (const d of body.results.data) for (const a of d.document_attach) {
    const url = a.record_location.startsWith('http') ? a.record_location : `https://www.eci.gov.in${a.record_location}`;
    await save(year, a.record_realname.replace(/\s+/g, '_'), url);
  }
}

(async () => {
  ST = parseState(process.argv[2]);
  const want = process.argv.slice(3).map(Number);
  for (const e of electionsOf(ST).filter(x => !want.length || want.includes(x.year))) {
    console.log(`${STATES[ST].name} ${e.year}`);
    if (e.docid) await fetchOld(String(e.year), e.docid);
    else if (ST === 'BR' && e.year === 2025) await fetchNew('2025', 16);
    else console.log('  no ECI report source in the registry');
  }
})().catch(e => { console.error(e); process.exit(1); });
