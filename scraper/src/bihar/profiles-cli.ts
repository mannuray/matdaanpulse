/**
 * Fetch Tier A leader profiles (Wikidata + Commons), upload photos once to our Vercel Blob store, write leader-profiles.json.
 * Usage: BLOB_READ_WRITE_TOKEN=… npx ts-node src/bihar/profiles-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { put } from '@vercel/blob';
import { DATA_DIR } from './load';
import { readEntity, readImageInfo, type Profile } from './profiles';
import type { LeadersFile } from './leaders-data';

const UA = 'MatdaanPulse/1.0 (mannu.ray@gmail.com)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const json = async (url: string) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json() as Promise<any>; };

(async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const leaders: LeadersFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaders.json'), 'utf8'));
  const file = path.join(DATA_DIR, 'leader-profiles.json');
  const out: Record<string, Profile> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const p of leaders.people) {
    if (!p.wikidata) continue;
    const prev = out[p.key];
    const ent = readEntity(Object.values((await json(`https://www.wikidata.org/wiki/Special:EntityData/${p.wikidata}.json`)).entities)[0]);
    // Facts are refreshed every run; a photo is downloaded and uploaded only once.
    let photo_url: string | null = prev?.photo_url ?? null, credit = prev?.credit ?? null;
    if (ent.image && !photo_url) {
      await sleep(1000);
      const pages = (await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${ent.image}`)}`)).query.pages;
      const info = readImageInfo(Object.values(pages)[0]);
      if (info) {
        const img = await fetch(info.thumbUrl, { headers: { 'User-Agent': UA } });
        if (!img.ok) throw new Error(`${img.status} ${info.thumbUrl}`);
        const type = img.headers.get('content-type') ?? 'image/jpeg';
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const blob = await put(`persons/${p.wikidata}/photo.${ext}`, Buffer.from(await img.arrayBuffer()), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: type, token });
        photo_url = blob.url; credit = info.credit;
      } else console.warn(`  ${p.key}: image has no licence metadata; skipped`);
    }
    out[p.key] = { key: p.key, wikidata: p.wikidata, date_of_birth: ent.dob, gender: ent.gender, wikipedia_url: ent.enwiki, photo_url, credit };
    console.log(`${p.key}: ${photo_url ? 'photo' : 'no photo'}${ent.dob ? `, born ${ent.dob}` : ''}`);
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n'); // after each person: a crash never loses an upload
    await sleep(1000);
  }
})().catch(e => { console.error(e); process.exit(1); });
