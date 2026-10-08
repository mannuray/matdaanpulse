import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { MediaNotConfiguredException, MediaStorageFailedException } from '../../common/exceptions';
import { validateUpload, type MediaKind } from './media-validation';

export interface UploadedMedia { url: string; pathname: string; content_type: string; size: number }

/**
 * Admin image uploads (party symbols, person photos) to the S3 bucket `S3_BUCKET` (public-read by bucket policy, served
 * from `S3_PUBLIC_BASE_URL`; AWS keys from the environment). The record stores the returned URL on Save. Replaced
 * Vercel Blob on 2026-10-05. Unset bucket = 503 MEDIA_0001.
 */
@Injectable()
export class MediaService {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  async upload(file: { buffer: Buffer; size: number } | undefined, kind: MediaKind, ownerId: string): Promise<UploadedMedia> {
    const bucket = this.config.get<string>('S3_BUCKET'), region = this.config.get<string>('S3_REGION');
    const base = this.config.get<string>('S3_PUBLIC_BASE_URL');
    if (!bucket || !region || !base) throw new MediaNotConfiguredException();
    const { path, contentType } = validateUpload(file, kind, ownerId);
    // A random suffix keeps every upload at a new URL (CDN and browser caches never show a replaced image).
    const key = path.replace(/(\.[a-z0-9]+)$/i, `-${randomBytes(4).toString('hex')}$1`);
    try {
      this.client ??= new S3Client({ region });
      // An SVG opened directly on the bucket origin downloads instead of rendering as a page (defence in depth on
      // top of the active-content check); <img> ignores Content-Disposition. S3 cannot set a CSP header per object.
      await this.client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: file!.buffer, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable',
        ...(contentType === 'image/svg+xml' && { ContentDisposition: 'attachment' }),
      }));
    } catch (err) {
      throw new MediaStorageFailedException(err instanceof Error ? err : new Error(String(err)));
    }
    return { url: `${base.replace(/\/+$/, '')}/${key}`, pathname: key, content_type: contentType, size: file!.size };
  }
}
