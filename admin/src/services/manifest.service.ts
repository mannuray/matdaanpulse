import { apiFetch } from './api-client';
import type { Manifest } from '../types';

export function getManifest(electionId: string) {
  return apiFetch<Manifest>(`/admin/elections/${electionId}/manifest`);
}

export function saveManifestDraft(electionId: string, manifest: object) {
  return apiFetch<Manifest>(`/admin/elections/${electionId}/manifest`, {
    method: 'PUT',
    body: JSON.stringify(manifest),
  });
}

export function publishManifest(electionId: string) {
  return apiFetch<Manifest>(`/admin/elections/${electionId}/manifest/publish`, { method: 'POST' });
}
