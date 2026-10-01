import { describe, it, expect } from 'vitest';
import { clockIst, formatIst, formatIstDate, isIsoDay, istDayEnd, istDayStart, timeAgo } from './time';

const NOW = Date.parse('2026-10-01T10:00:00Z');

describe('timeAgo', () => {
  it.each([
    ['2026-10-01T09:59:30Z', 'just now'],
    ['2026-10-01T09:55:00Z', '5 min ago'],
    ['2026-10-01T07:00:00Z', '3 h ago'],
    ['2026-09-29T10:00:00Z', '2 d ago'],
    ['2026-10-01T10:05:00Z', 'just now'],
    ['not a date', ''],
  ])('%s → %s', (iso, expected) => expect(timeAgo(iso, NOW)).toBe(expected));
});

describe('IST formatting (independent of the machine zone)', () => {
  it('formatIst shows the IST date and 24-hour time', () => {
    expect(formatIst('2026-09-30T20:00:00Z')).toBe('01 Oct 2026, 01:30');
  });
  it('formatIstDate and clockIst', () => {
    expect(formatIstDate('2026-10-01T05:00:00Z')).toBe('1 Oct 2026');
    expect(clockIst('2026-09-30T10:00:00.000Z')).toBe('15:30:00');
  });
  it('an unparseable value formats to an empty string', () => {
    expect(formatIst('nope')).toBe('');
    expect(clockIst('')).toBe('');
  });
});

describe('IST day bounds (audit filter, both ends inclusive)', () => {
  it('start and end of the IST calendar day', () => {
    expect(istDayStart('2026-10-01')).toBe('2026-10-01T00:00:00.000+05:30');
    expect(istDayEnd('2026-10-01')).toBe('2026-10-01T23:59:59.999+05:30');
    expect(new Date(istDayStart('2026-10-01')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(new Date(istDayEnd('2026-10-01')).toISOString()).toBe('2026-10-01T18:29:59.999Z');
  });
  it('anything that is not YYYY-MM-DD gives an empty string', () => {
    for (const bad of ['', '01/10/2026', '2026-10-1', 'MANIFEST_PUBLISH']) {
      expect(istDayStart(bad)).toBe('');
      expect(istDayEnd(bad)).toBe('');
      expect(isIsoDay(bad)).toBe(false);
    }
    expect(isIsoDay('2026-10-01')).toBe(true);
    expect(isIsoDay(20261001)).toBe(false);
  });
});
