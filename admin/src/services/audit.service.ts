import { apiFetch } from './api-client';
import type { AuditLog } from '../types';

export async function getAuditLogs(filters?: {
  user_id?: string;
  action?: string;
  entity_type?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.user_id) params.set('user_id', filters.user_id);
  if (filters?.action) params.set('action', filters.action);
  if (filters?.entity_type) params.set('entity_type', filters.entity_type);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const qs = params.toString();
  return (await apiFetch<AuditLog[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`)) || [];
}
