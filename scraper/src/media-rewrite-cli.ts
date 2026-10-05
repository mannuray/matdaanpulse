/** Write database/seed_media_s3_v1.sql (Blob → S3 URL rewrite). Usage: npx ts-node src/media-rewrite-cli.ts  (S3_PUBLIC_BASE_URL from .env) */
import * as fs from 'fs';
import * as path from 'path';
import { emitMediaRewriteSeed } from './media-store';

const BLOB = 'https://ont9tlwrlxhj4iwf.public.blob.vercel-storage.com';
const s3 = process.env.S3_PUBLIC_BASE_URL;
if (!s3) throw new Error('S3_PUBLIC_BASE_URL is not set');
fs.writeFileSync(path.resolve(__dirname, '../../database/seed_media_s3_v1.sql'), emitMediaRewriteSeed(BLOB, s3));
console.log('Wrote seed_media_s3_v1.sql');
