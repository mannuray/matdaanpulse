import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put } from '@vercel/blob';
import { MediaNotConfiguredException, MediaStorageFailedException } from '../../common/exceptions';
import { validateUpload, type MediaKind } from './media-validation';

export interface UploadedMedia { url: string; pathname: string; content_type: string; size: number }

/** Admin image uploads (party symbols, person photos) to Vercel Blob. The record stores the returned URL on Save. */
@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  async upload(file: { buffer: Buffer; size: number } | undefined, kind: MediaKind, ownerId: string): Promise<UploadedMedia> {
    const token = this.config.get<string>('BLOB_READ_WRITE_TOKEN');
    if (!token) throw new MediaNotConfiguredException();
    const { path, contentType } = validateUpload(file, kind, ownerId);
    let blob: Awaited<ReturnType<typeof put>>;
    try {
      blob = await put(path, file!.buffer, { access: 'public', addRandomSuffix: true, contentType, token });
    } catch (err) {
      throw new MediaStorageFailedException(err instanceof Error ? err : new Error(String(err)));
    }
    return { url: blob.url, pathname: blob.pathname, content_type: contentType, size: file!.size };
  }
}
