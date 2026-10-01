import { describe, it, expect } from 'vitest';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, FEEDBACK_STATUS_LABEL, firstLine, isFeedbackStatus, kindMeta } from './feedback';

describe('feedback metadata', () => {
  it('kind badges: bug rose, data error amber, suggestion indigo, other slate', () => {
    expect(FEEDBACK_KINDS.bug).toEqual({ label: 'Bug', tone: 'bad' });
    expect(FEEDBACK_KINDS.data_error).toEqual({ label: 'Data error', tone: 'warn' });
    expect(FEEDBACK_KINDS.suggestion).toEqual({ label: 'Suggestion', tone: 'accent' });
    expect(FEEDBACK_KINDS.other).toEqual({ label: 'Other', tone: 'muted' });
    expect(kindMeta('spam')).toEqual({ label: 'spam', tone: 'muted' });
  });

  it('statuses', () => {
    expect(FEEDBACK_STATUSES).toEqual(['new', 'read', 'resolved']);
    expect(FEEDBACK_STATUS_LABEL.resolved).toBe('Resolved');
    expect(isFeedbackStatus('read')).toBe(true);
    expect(isFeedbackStatus('archived')).toBe(false);
    expect(isFeedbackStatus('')).toBe(false);
  });

  it('firstLine: first non-empty line, trimmed and capped', () => {
    expect(firstLine('\n  Round 2 total is wrong  \nDetails…')).toBe('Round 2 total is wrong');
    expect(firstLine('a'.repeat(130), 120)).toBe(`${'a'.repeat(119)}…`);
    expect(firstLine('   ')).toBe('');
  });
});
