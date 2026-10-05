/**
 * Re-host every image that was on Vercel Blob in our S3 bucket under the same key (the Blob store was suspended on
 * 2026-10-04 and serves nothing, so images come again from their sources): candidate photos from the ECI photo URL
 * saved in photos-<year>.json, leader photos from their Commons file (credit.source_url). Rewrites the URLs in those
 * files; resumable (entries already on S3 are skipped).
 * Usage: npx ts-node src/bihar/media-migrate-cli.ts   (S3_* and AWS keys from scraper/.env)
 */
import * as fs from 'fs';
import * as path from 'path';
import { BLOB_BASE, mediaStoreFromEnv } from '../media-store';
import { readImageInfo } from './profiles';
import { shrinkPhoto } from './photos';
import { STATES } from './elections';
import { dataDir } from './load';

const UA = 'MatdaanPulse/1.0 (mannu.ray@gmail.com)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function fetchBody(url: string, attempts = 4): Promise<Buffer> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...(i > 1 ? { 'Accept-Encoding': 'identity' } : {}) } });
      if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status });
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (i >= attempts || (status !== undefined && status !== 429 && status < 500)) throw e;
      await sleep(5000 * i);
    }
  }
}

(async () => {
  const store = mediaStoreFromEnv();
  const failed: string[] = [];
  for (const st of Object.values(STATES)) {
    const dir = dataDir(st.code);
    for (const f of fs.readdirSync(dir).filter(x => /^photos-\d{4}\.json$/.test(x))) {
      const file = path.join(dir, f);
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { entries: { url: string; eciUrl: string; name: string }[] };
      let moved = 0;
      for (const e of data.entries) {
        if (!BLOB_BASE.test(e.url)) continue;
        try {
          e.url = await store.put(e.url.replace(BLOB_BASE, ''), await shrinkPhoto(await fetchBody(e.eciUrl)), 'image/jpeg');
          moved++;
          if (moved % 25 === 0) fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
          await sleep(300);
        } catch (err) { failed.push(`${st.slug}/${f}: ${e.name} (${(err as Error).message})`); }
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
      console.log(`${st.slug}/${f}: ${moved} re-hosted`);
    }
    const pf = path.join(dir, 'leader-profiles.json');
    if (!fs.existsSync(pf)) continue;
    const profiles = JSON.parse(fs.readFileSync(pf, 'utf8')) as Record<string, { photo_url: string | null; credit: { source_url: string } | null }>;
    let moved = 0;
    for (const [key, p] of Object.entries(profiles)) {
      if (!p.photo_url || !BLOB_BASE.test(p.photo_url) || !p.credit) continue;
      try {
        const title = decodeURIComponent(p.credit.source_url.split('/wiki/')[1]);
        const api = await (await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(title)}`, { headers: { 'User-Agent': UA } })).json() as { query: { pages: Record<string, unknown> } };
        const info = readImageInfo(Object.values(api.query.pages)[0]);
        if (!info) throw new Error('no image info');
        const keyPath = p.photo_url.replace(BLOB_BASE, '');
        const type = keyPath.endsWith('.png') ? 'image/png' : keyPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        p.photo_url = await store.put(keyPath, await fetchBody(info.thumbUrl), type);
        moved++;
        fs.writeFileSync(pf, JSON.stringify(profiles, null, 1) + '\n');
        await sleep(1000);
      } catch (err) { failed.push(`${st.slug} leader ${key}: ${(err as Error).message}`); }
    }
    console.log(`${st.slug}/leader-profiles.json: ${moved} re-hosted`);
  }
  console.log(`failed: ${failed.length}${failed.length ? '\n  ' + failed.join('\n  ') : ''}`);
})().catch(e => { console.error(e); process.exit(1); });
