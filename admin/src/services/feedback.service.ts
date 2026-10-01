import { apiFetch, type PaginatedResponse } from './api-client';
import type { Feedback, FeedbackStatus } from '../types';

export async function getFeedback(page = 1, limit = 50, status?: FeedbackStatus) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiFetch<PaginatedResponse<Feedback>>(`/admin/feedback?${params.toString()}`);
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  return apiFetch<Feedback>(`/admin/feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
