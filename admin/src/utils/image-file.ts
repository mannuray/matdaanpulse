import type { MediaKind } from '../services/media.service';

const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MB = 1024 * 1024;
const MAX: Record<MediaKind, number> = { 'party-logo': MB, 'party-eci': MB, 'person-photo': 2 * MB };

/** Same limits as the server (which checks the bytes too); an error message, or null when the file may be sent. */
export function checkImageFile(file: File, kind: MediaKind): string | null {
  if (!TYPES.includes(file.type)) return 'Use a PNG, JPEG, WebP or SVG image';
  if (file.size > MAX[kind]) return `Image is too large (max ${MAX[kind] / MB} MB)`;
  return null;
}
