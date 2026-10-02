import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MEDIA_KINDS = ['party-logo', 'party-eci', 'person-photo'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const MB = 1024 * 1024;
export const MAX_BYTES: Record<MediaKind, number> = { 'party-logo': MB, 'party-eci': MB, 'person-photo': 2 * MB };
/** Multer's hard cap: the largest per-kind limit (the per-kind check runs after). */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_BYTES));

export const OWNER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface ImageType { ext: 'png' | 'jpg' | 'webp' | 'svg'; contentType: string }

// XML prolog, comments and a doctype may come before the <svg> root (seed files have them).
const SVG_ROOT = /^(?:<\?xml[^>]*>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>/]/i;

/** The image type from the file's bytes, or null when it is not PNG, JPEG, WebP or SVG. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  const head = buf.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart();
  if (SVG_ROOT.test(head)) return { ext: 'svg', contentType: 'image/svg+xml' };
  return null;
}

const NAMES: Record<MediaKind, string> = { 'party-logo': 'logo', 'party-eci': 'eci', 'person-photo': 'photo' };
export function blobPath(kind: MediaKind, ownerId: string, ext: string): string {
  return `${kind === 'person-photo' ? 'persons' : 'parties'}/${ownerId}/${NAMES[kind]}.${ext}`;
}

/** Checks an uploaded file for its kind; throws 400/413 with a message the admin shows as-is. */
export function validateUpload(
  file: { buffer: Buffer; size: number } | undefined,
  kind: MediaKind,
  ownerId: string,
): ImageType & { path: string } {
  if (!MEDIA_KINDS.includes(kind)) throw new BadRequestException(`Unknown image kind "${kind}"`);
  if (!OWNER_ID.test(ownerId ?? '')) throw new BadRequestException('Invalid owner id');
  if (!file || !file.buffer?.length) throw new BadRequestException('Choose an image file');
  if (file.size > MAX_BYTES[kind]) {
    throw new PayloadTooLargeException(`Image is too large (max ${MAX_BYTES[kind] / MB} MB)`);
  }
  const type = sniffImage(file.buffer);
  if (!type) throw new BadRequestException('Use a PNG, JPEG, WebP or SVG image');
  return { ...type, path: blobPath(kind, ownerId, type.ext) };
}
