import { apiFetch, type PaginatedResponse } from './api-client';
import { istDayEnd, istDayStart } from '../utils/time';
import type { AuditLog } from '../types';

/** Rows per page of GET /admin/audit-logs (newest first; the backend allows up to 200). */
export const AUDIT_PAGE_SIZE = 100;

export interface AuditFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  /** IST calendar day, YYYY-MM-DD (a date input's value); included from 00:00 IST. */
  from?: string;
  /** IST calendar day, YYYY-MM-DD; included until 23:59:59.999 IST. */
  to?: string;
}

/** One page of the audit log with its total (page + limit are always sent, so the backend returns the paged shape). */
export async function getAuditLogs(filters: AuditFilters = {}, page = 1, limit = AUDIT_PAGE_SIZE) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.action) params.set('action', filters.action);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  const from = filters.from ? istDayStart(filters.from) : '';
  const to = filters.to ? istDayEnd(filters.to) : '';
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return apiFetch<PaginatedResponse<AuditLog>>(`/admin/audit-logs?${params.toString()}`);
}
