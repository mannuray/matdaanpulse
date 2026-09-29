import { describe, it, expect } from 'vitest';
import { formatCompact, formatSummaryValue, primaryCell } from '../format';

describe('formatCompact', () => {
  it('matches the legacy margin format', () => {
    expect(formatCompact(27)).toBe('27');
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(1000)).toBe('1.0K');
    expect(formatCompact(21100)).toBe('21.1K');
    expect(formatCompact(73572)).toBe('73.6K');
    expect(formatCompact(100000)).toBe('1.0L');
    expect(formatCompact(1234567)).toBe('12.3L');
  });
});

describe('formatSummaryValue', () => {
  it('formats every ValueFormat', () => {
    expect(formatSummaryValue(12345, 'int')).toBe((12345).toLocaleString());
    expect(formatSummaryValue(12.34, 'pct')).toBe('12.3%');
    expect(formatSummaryValue(54.4, 'pct0')).toBe('54%');
    expect(formatSummaryValue(5, 'signed')).toBe('+5');
    expect(formatSummaryValue(-5, 'signed')).toBe('−5');
    expect(formatSummaryValue(35, 'signed1')).toBe('+35.0');
    expect(formatSummaryValue(-23.1, 'signed1')).toBe('−23.1');
    expect(formatSummaryValue(0, 'signed1')).toBe('0.0');
    expect(formatSummaryValue(73572, 'compact')).toBe('73.6K');
    expect(formatSummaryValue(14777000, 'lakh')).toBe('147.8L');
    expect(formatSummaryValue(67.7, 'pp')).toBe('+67.7 pp');
    expect(formatSummaryValue(1, 'result')).toBe('Won');
    expect(formatSummaryValue(0, 'result', { won: 'W', lost: 'L' })).toBe('L');
    expect(formatSummaryValue(3, 'text', { text: '3/1.2K' })).toBe('3/1.2K');
  });
  it('renders a dash for missing numbers, and "–" for a zero in a dash column', () => {
    expect(formatSummaryValue(null, 'int')).toBe('—');
    expect(formatSummaryValue(null, 'compact')).toBe('—');
    expect(formatSummaryValue(0, 'intDash')).toBe('–');
    expect(formatSummaryValue(null, 'intDash')).toBe('–');
    expect(formatSummaryValue(14, 'intDash')).toBe('14');
    expect(formatSummaryValue(0, 'int')).toBe('0');
  });
});

describe('primaryCell', () => {
  it('picks a column of [value, ...extra]', () => {
    const r = { value: 1, valueFormat: 'intDash' as const, extra: [{ value: 2, format: 'int' as const }, { value: 3, format: 'pct' as const }] };
    expect(primaryCell(r)).toMatchObject({ value: 1, format: 'intDash' });
    expect(primaryCell(r, 2)).toEqual({ value: 3, format: 'pct' });
    expect(primaryCell(r, 9)).toMatchObject({ value: 1 });
  });
});
