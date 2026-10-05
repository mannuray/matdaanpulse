import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMediaStore, s3UrlFor, blobToS3, emitMediaRewriteSeed } from '../media-store';

describe('media store (S3, with a local copy of every image)', () => {
  it('uploads under the key, keeps a local copy, and returns the public URL', async () => {
    const sent: { Key?: string; ContentType?: string; CacheControl?: string }[] = [];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
    const store = createMediaStore({ bucket: 'b', publicBase: 'https://b.s3.ap-south-1.amazonaws.com', localDir: dir,
      send: async cmd => { sent.push(cmd.input); return {}; } });
    const url = await store.put('persons/eci2026/kl-1-2.jpg', Buffer.from('jpeg'), 'image/jpeg');
    expect(url).toBe('https://b.s3.ap-south-1.amazonaws.com/persons/eci2026/kl-1-2.jpg');
    expect(sent[0]).toMatchObject({ Key: 'persons/eci2026/kl-1-2.jpg', ContentType: 'image/jpeg' });
    expect(sent[0].CacheControl ?? "").toMatch(/max-age=\d+/);
    expect(fs.readFileSync(path.join(dir, 'persons/eci2026/kl-1-2.jpg'), 'utf8')).toBe('jpeg');
  });
  it('maps an old Vercel Blob URL to the same key on S3', () => {
    expect(blobToS3('https://ont9tlwrlxhj4iwf.public.blob.vercel-storage.com/persons/Q1/photo.jpg', 'https://b.s3.ap-south-1.amazonaws.com'))
      .toBe('https://b.s3.ap-south-1.amazonaws.com/persons/Q1/photo.jpg');
    expect(blobToS3('https://example.com/x.jpg', 'https://b')).toBe('https://example.com/x.jpg');
    expect(s3UrlFor('https://b/', 'persons/a.jpg')).toBe('https://b/persons/a.jpg');
  });
});

describe('emitMediaRewriteSeed', () => {
  const sql = emitMediaRewriteSeed('https://ont9tlwrlxhj4iwf.public.blob.vercel-storage.com', 'https://b.s3.ap-south-1.amazonaws.com');
  it('rewrites only URLs still on the Blob host, keeping the key (admin changes win)', () => {
    expect(sql).toContain("UPDATE persons SET photo_url = 'https://b.s3.ap-south-1.amazonaws.com' || substr(photo_url, 56) WHERE photo_url LIKE 'https://ont9tlwrlxhj4iwf.public.blob.vercel-storage.com/%';");
    expect(sql).toContain("UPDATE parties SET symbol_url");
  });
  it('moves image credits without colliding with a credit already on S3', () => {
    expect(sql).toMatch(/UPDATE image_credits c SET url = .* WHERE c\.url LIKE '[^']+%'\s+AND NOT EXISTS \(SELECT 1 FROM image_credits d WHERE d\.url = /);
  });
  it('runs once (seed_runs)', () => {
    expect(sql).toContain("seed_runs WHERE name = 'seed_media_s3_v1'");
  });
});
