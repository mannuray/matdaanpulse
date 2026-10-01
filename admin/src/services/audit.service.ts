import { apiFetch } from './api-client';
import { istDayEnd, istDayStart } from '../utils/time';
import type { AuditLog } from '../types';

/** GET /admin/audit-logs returns at most this many entries, newest first. */
export const AUDIT_LIMIT = 200;

export interface AuditFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  /** IST calendar day, YYYY-MM-DD (a date input's value); included from 00:00 IST. */
  from?: string;
  /** IST calendar day, YYYY-MM-DD; included until 23:59:59.999 IST. */
  to?: string;
}

export async function getAuditLogs(filters: AuditFilters = {}) {
  const params = new URLSearchParams();
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.action) params.set('action', filters.action);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  const from = filters.from ? istDayStart(filters.from) : '';
  const to = filters.to ? istDayEnd(filters.to) : '';
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return (await apiFetch<AuditLog[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`)) || [];
}
