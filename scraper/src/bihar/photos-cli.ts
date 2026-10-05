/**
 * Top-4 candidate photos of a state's latest election: ECI candidate-wise pages (the live results site, else Wayback)
 * → ECI photo → 240px JPEG in our S3 bucket (src/media-store.ts) → scraper/data/<slug>/photos-<year>.json (resumable) → the state's photos
 * seed (seed_bihar_candidate_photos.sql / seed_<slug>_candidate_photos.sql).
 * Usage: npx ts-node src/bihar/photos-cli.ts [STATE]   (default BR; S3_* and AWS keys from scraper/.env)
 */
import * as fs from 'fs';
import * as path from 'path';
import { mediaStoreFromEnv } from '../media-store';
import { parseCandidateDetailPage } from '../adapters/eci-vs-adapter';
import { electionOf, parseState } from './elections';
import { trackOf } from './current-track';
import { rawDir } from './load';
import { DB_DIR, loadSeeded } from './seeded';
import { BIHAR_PHOTOS, emitPhotosSeed, matchPhoto, shrinkPhoto, topCandidates } from './photos';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const ST = parseState(process.argv[2] ?? 'BR');
const track = trackOf(ST);
const YEAR = track.years[track.years.length - 1];
const site = electionOf(ST, YEAR).resultsSite!;
// Bihar keeps its original cache and Blob paths.
const RAW = ST === 'BR' ? path.resolve(__dirname, '../../data/raw/eci2025') : path.join(rawDir(ST), String(YEAR), 'cand');
const OUT = path.join(track.dir, `photos-${YEAR}.json`);
const PAGE = (n: number) => `${site.base}candidateswise-${site.eciCode}${n}.htm`;
const KEY_PATH = (n: number, serial: number) => (ST === 'BR' ? `persons/eci2025/${n}-${serial}.jpg` : `persons/eci${YEAR}/${track.state.slug}-${n}-${serial}.jpg`);
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
  const store = mediaStoreFromEnv();
  fs.mkdirSync(RAW, { recursive: true });
  const done: Entry[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).entries : [];
  const have = new Set(done.map(e => `${e.constNo}:${e.serial}`));
  const unmatched: string[] = [];
  const save = () => fs.writeFileSync(OUT, JSON.stringify({ entries: done.sort((a, b) => a.constNo - b.constNo || a.serial - b.serial), unmatched }, null, 1) + '\n');

  // Every archived 200 snapshot per seat, newest first (some are truncated, so older ones are the fallback). Built only
  // when a page is not on the live results site (one CDX query for the whole state).
  let snapsCache: Map<number, string[]> | null = null;
  const snapshots = async () => {
    if (snapsCache) return snapsCache;
    const prefix = PAGE(0).replace(/^https:\/\//, '').replace(/0\.htm$/, '');
    const cdx = (await (await get(`https://web.archive.org/cdx/search/cdx?url=${prefix}&matchType=prefix&filter=statuscode:200&fl=timestamp,original&output=json`)).json()) as string[][];
    snapsCache = new Map();
    for (const [ts, orig] of cdx.slice(1)) {
      const m = new RegExp(`candidateswise-${site.eciCode}(\\d+)\\.htm`).exec(orig);
      if (m) { const n = Number(m[1]); snapsCache.set(n, [...(snapsCache.get(n) ?? []), `${ts}/${orig}`]); }
    }
    for (const list of snapsCache.values()) list.sort().reverse();
    return snapsCache;
  };

  const s = loadSeeded(ST, YEAR);
  for (const seat of s.json.seats) {
    const n = seat.constNo;
    const top = topCandidates(seat).filter(c => !have.has(`${n}:${c.serial}`));
    if (!top.length) continue;
    const cache = path.join(RAW, `cand-${n}.htm`);
    const metaFile = `${cache}.snapshot`;
    let snapshot = fs.existsSync(metaFile) ? fs.readFileSync(metaFile, 'utf8') : '';
    if (!fs.existsSync(cache)) {
      try {
        const html = await (await get(PAGE(n))).text();
        if (parseCandidateDetailPage(html).length) { fs.writeFileSync(cache, html); fs.writeFileSync(metaFile, `live/${PAGE(n)}`); snapshot = `live/${PAGE(n)}`; await sleep(1500); }
      } catch { /* not live: Wayback below */ }
    }
    if (!fs.existsSync(cache)) {
      const list = (await snapshots()).get(n) ?? [];
      if (!list.length) { unmatched.push(`seat ${n}: no live or archived page`); continue; }
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
    const sourceUrl = snapshot.startsWith('live/') ? snapshot.slice(5) : `https://web.archive.org/web/${snapshot}`;
    for (const c of top) {
      const eciUrl = matchPhoto(c, eci);
      if (!eciUrl) { unmatched.push(`seat ${n}: ${c.name} (${c.partyId}, ${c.votes})`); continue; }
      let raw: Buffer;
      try { raw = await fetchBody(eciUrl); } catch (e) { unmatched.push(`seat ${n}: ${c.name} photo download failed (${(e as Error).message})`); continue; }
      const jpeg = await shrinkPhoto(raw);
      const url = await store.put(KEY_PATH(n, c.serial), jpeg, 'image/jpeg');
      done.push({ constNo: n, serial: c.serial, candidateId: s.idOf(n, c), name: c.name, url, eciUrl, sourceUrl });
      have.add(`${n}:${c.serial}`);
      save();
      await sleep(1500);
    }
    console.log(`seat ${n}: ${done.filter(e => e.constNo === n).length} photos`);
  }
  save();
  const opts = ST === 'BR' ? BIHAR_PHOTOS : { seedName: track.photosSeed, label: `${track.state.name} ${YEAR}` };
  fs.writeFileSync(path.join(DB_DIR, `${track.photosSeed}.sql`), emitPhotosSeed(done.map(e => ({ candidateId: e.candidateId, url: e.url, sourceUrl: e.sourceUrl })), opts) + '\n');
  console.log(`done: ${done.length} photos, ${unmatched.length} unmatched`);
})().catch(e => { console.error(e); process.exit(1); });
