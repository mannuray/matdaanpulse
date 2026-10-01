import { apiFetch } from './api-client';

export type FeedbackKind = 'bug' | 'data_error' | 'suggestion' | 'other';
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['bug', 'data_error', 'suggestion', 'other'];
export const FEEDBACK_MESSAGE_MIN = 5;
export const FEEDBACK_MESSAGE_MAX = 2000;

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  email?: string;
  page?: string;
  /** Honeypot: hidden from people, so only bots fill it. The server drops such posts. */
  website?: string;
}

export function sendFeedback(input: FeedbackInput) {
  return apiFetch<{ ok: true }>('/feedback', { method: 'POST', body: JSON.stringify(input) });
}
