import { apiFetch } from './api-client';

export type MediaKind = 'party-logo' | 'party-eci' | 'person-photo';
export interface UploadedImage { url: string; pathname: string; content_type: string; size: number }

/** Uploads one image; the caller puts the returned URL in the record's form (saved with the record). */
export function uploadImage(file: File, kind: MediaKind, ownerId: string): Promise<UploadedImage> {
  const body = new FormData();
  body.append('kind', kind);
  body.append('owner_id', ownerId);
  body.append('file', file);
  return apiFetch<UploadedImage>('/admin/media', { method: 'POST', body });
}
