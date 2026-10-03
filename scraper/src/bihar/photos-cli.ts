/**
 * Bihar 2025 top-4 candidate photos: archived ECI candidate-wise pages (Wayback) → ECI photo → 240px JPEG in our Blob
 * store → scraper/data/bihar/photos-2025.json (resumable) → database/seed_bihar_candidate_photos.sql.
 * Usage: BLOB_READ_WRITE_TOKEN=… npx ts-node src/bihar/photos-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { parseCandidateDetailPage } from '../adapters/eci-vs-adapter';
import { DATA_DIR } from './load';
import { DB_DIR, loadSeeded } from './seeded';
import { emitPhotosSeed, matchPhoto, topCandidates } from './photos';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const RAW = path.resolve(__dirname, '../../data/raw/eci2025');
const OUT = path.join(DATA_DIR, 'photos-2025.json');
const PAGE = (n: number) => `https://results.eci.gov.in/ResultAcGenNov2025/candidateswise-S04${n}.htm`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Entry { constNo: number; serial: number; candidateId: string; name: string; url: string; eciUrl: string; sourceUrl: string }

/** GET with retries; the body is read inside the retry (a server can mislabel gzip), the last tries without compression. */
async function fetchBody(url: string, attempts = 4): Promise<Buffer> {
  for (let i = 1; ; i++) {
    try {
      const headers: Record<string, string> = { 'User-Agent': UA, ...(i > 1 ? { 'Accept-Encoding': 'identity' } : {}) };
      const r = await fetch(url, { headers });
      if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status });
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (i >= attempts || (status !== undefined && status !== 429 && status < 500)) throw e;
      await sleep(5000 * i);
    }
  }
}
const get = async (url: string) => ({ text: async () => (await fetchBody(url)).toString('utf8'), json: async () => JSON.parse((await fetchBody(url)).toString('utf8')) });

(async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  fs.mkdirSync(RAW, { recursive: true });
  const done: Entry[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).entries : [];
  const have = new Set(done.map(e => `${e.constNo}:${e.serial}`));
  const unmatched: string[] = [];
  const save = () => fs.writeFileSync(OUT, JSON.stringify({ entries: done.sort((a, b) => a.constNo - b.constNo || a.serial - b.serial), unmatched }, null, 1) + '\n');

  // Latest archived 200 snapshot of every seat's page, in one CDX query.
  const cdx = (await (await get('https://web.archive.org/cdx/search/cdx?url=results.eci.gov.in/ResultAcGenNov2025/candidateswise-S04&matchType=prefix&filter=statuscode:200&fl=timestamp,original&output=json')).json()) as string[][];
  // Every archived 200 snapshot per seat, newest first: some snapshots are truncated, so older ones are the fallback.
  const snaps = new Map<number, string[]>();
  for (const [ts, orig] of cdx.slice(1)) {
    const m = /candidateswise-S04(\d+)\.htm/.exec(orig);
    if (m) { const n = Number(m[1]); snaps.set(n, [...(snaps.get(n) ?? []), `${ts}/${orig}`]); }
  }
  for (const list of snaps.values()) list.sort().reverse();

  const s = loadSeeded('BR', 2025);
  for (const seat of s.json.seats) {
    const n = seat.constNo;
    const top = topCandidates(seat).filter(c => !have.has(`${n}:${c.serial}`));
    if (!top.length) continue;
    const list = snaps.get(n) ?? [];
    if (!list.length) { unmatched.push(`seat ${n}: no archived page`); continue; }
    const cache = path.join(RAW, `cand-${n}.htm`);
    const metaFile = `${cache}.snapshot`;
    let snapshot = fs.existsSync(metaFile) ? fs.readFileSync(metaFile, 'utf8') : list[0];
    if (!fs.existsSync(cache)) {
      let ok = false;
      for (const candidate of list) {
        const [ts, orig] = [candidate.slice(0, candidate.indexOf('/')), candidate.slice(candidate.indexOf('/') + 1)];
        try {
          const html = await (await get(`https://web.archive.org/web/${ts}id_/${orig}`)).text();
          if (!parseCandidateDetailPage(html).length) throw new Error('no candidates on the page');
          fs.writeFileSync(cache, html); fs.writeFileSync(metaFile, candidate); snapshot = candidate; ok = true; break;
        } catch { await sleep(2000); }
      }
      if (!ok) { unmatched.push(`seat ${n}: no readable archived page (${list.length} snapshots tried)`); continue; }
      await sleep(2000);
    }
    const eci = parseCandidateDetailPage(fs.readFileSync(cache, 'utf8'));
    const sourceUrl = `https://web.archive.org/web/${snapshot}`;
    for (const c of top) {
      const eciUrl = matchPhoto(c, eci);
      if (!eciUrl) { unmatched.push(`seat ${n}: ${c.name} (${c.partyId}, ${c.votes})`); continue; }
      let raw: Buffer;
      try { raw = await fetchBody(eciUrl); } catch (e) { unmatched.push(`seat ${n}: ${c.name} photo download failed (${(e as Error).message})`); continue; }
      const jpeg = await sharp(raw).rotate().resize({ width: 240, height: 300, fit: 'cover', position: 'top' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      const blob = await put(`persons/eci2025/${n}-${c.serial}.jpg`, jpeg, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/jpeg', token });
      done.push({ constNo: n, serial: c.serial, candidateId: s.idOf(n, c), name: c.name, url: blob.url, eciUrl, sourceUrl });
      have.add(`${n}:${c.serial}`);
      save();
      await sleep(1500);
    }
    console.log(`seat ${n}: ${done.filter(e => e.constNo === n).length} photos`);
  }
  save();
  fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_candidate_photos.sql'), emitPhotosSeed(done.map(e => ({ candidateId: e.candidateId, url: e.url, sourceUrl: e.sourceUrl }))) + '\n');
  console.log(`done: ${done.length} photos, ${unmatched.length} unmatched`);
})().catch(e => { console.error(e); process.exit(1); });
