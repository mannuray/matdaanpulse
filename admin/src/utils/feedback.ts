import type { Tone } from '../components/ui/Badge';
import type { FeedbackKind, FeedbackStatus } from '../types';

/** Kind badges (NOTES.md): bug rose, data error amber, suggestion indigo, other slate. */
export const FEEDBACK_KINDS: Record<FeedbackKind, { label: string; tone: Tone }> = {
  bug: { label: 'Bug', tone: 'bad' },
  data_error: { label: 'Data error', tone: 'warn' },
  suggestion: { label: 'Suggestion', tone: 'accent' },
  other: { label: 'Other', tone: 'muted' },
};

export const kindMeta = (kind: string): { label: string; tone: Tone } => FEEDBACK_KINDS[kind as FeedbackKind] ?? { label: kind, tone: 'muted' };

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['new', 'read', 'resolved'];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = { new: 'New', read: 'Read', resolved: 'Resolved' };
export const FEEDBACK_STATUS_TONE: Record<FeedbackStatus, Tone> = { new: 'accent', read: 'muted', resolved: 'ok' };
export const isFeedbackStatus = (v: unknown): v is FeedbackStatus => FEEDBACK_STATUSES.includes(v as FeedbackStatus);

/** First non-empty line of a message, trimmed, cut to `max` characters with an ellipsis. */
export function firstLine(message: string, max = 120): string {
  const line = message.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** Fired on window when a report's status changes, so the top-bar bell recounts straight away. */
export const FEEDBACK_CHANGED_EVENT = 'matdaanpulse:feedback-changed';
export const notifyFeedbackChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEEDBACK_CHANGED_EVENT)); };
