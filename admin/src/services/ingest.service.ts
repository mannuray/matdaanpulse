import { apiFetch } from './api-client';
import type { HoldRow, IngestKeyRow, IngestStatus, ShardSelector } from '../types';

const e = encodeURIComponent;
export const getIngestStatus = (id: string) => apiFetch<IngestStatus>(`/admin/elections/${id}/ingest`);
export const putFeedSettings = (id: string, b: { active_source: string | null; hold_minutes: number }) => apiFetch<IngestStatus>(`/admin/elections/${id}/ingest`, { method: 'PUT', body: JSON.stringify(b) });
export const getSources = async (id: string) => (await apiFetch<string[]>(`/admin/elections/${id}/ingest/sources`)) ?? [];
export const putShard = (id: string, name: string, b: { selector: ShardSelector; source_override: string | null }) => apiFetch(`/admin/elections/${id}/ingest/shards/${e(name)}`, { method: 'PUT', body: JSON.stringify(b) });
export const deleteShard = (id: string, name: string) => apiFetch(`/admin/elections/${id}/ingest/shards/${e(name)}`, { method: 'DELETE' });
export const getHolds = async (id: string) => (await apiFetch<HoldRow[]>(`/admin/elections/${id}/holds`)) ?? [];
export const releaseHold = (id: string, constId: string) => apiFetch(`/admin/elections/${id}/holds/${e(constId)}`, { method: 'DELETE' });
export const correctSeat = (id: string, constId: string, b: { state: string; round?: { current: number; total: number } | null; votes: Record<string, number> }) =>
  apiFetch<{ outcome: 'applied' | 'unchanged'; hold_expires_at: string }>(`/admin/elections/${id}/seats/${e(constId)}`, { method: 'PUT', body: JSON.stringify(b) });
export const getIngestKeys = async () => (await apiFetch<IngestKeyRow[]>('/admin/ingest-keys')) ?? [];
export const createIngestKey = (name: string, election_id: string, expires_at: string) => apiFetch<{ key: string; row: IngestKeyRow }>('/admin/ingest-keys', { method: 'POST', body: JSON.stringify({ name, election_id, expires_at }) });
export const revokeIngestKey = (id: string) => apiFetch(`/admin/ingest-keys/${id}`, { method: 'DELETE' });
export const reopenElection = (id: string) => apiFetch(`/admin/elections/${id}/reopen`, { method: 'POST' });
