import type { SummaryCell, ValueFormat } from './types';

/** Margin display: 950, 21.1K, 1.2L (same rule as the legacy summary's formatMargin). */
export function formatCompact(m: number): string {
  if (m >= 100000) return `${(m / 100000).toFixed(1)}L`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}K`;
  return String(m);
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

/** Text for one number; `result` needs translated words, passed by the view. */
export function formatSummaryValue(v: number | null, format: ValueFormat, opts: { text?: string; won?: string; lost?: string } = {}): string {
  if (format === 'text') return opts.text ?? '—';
  if (v == null || Number.isNaN(v)) return format === 'intDash' ? '–' : '—';
  switch (format) {
    case 'pct': return `${v.toFixed(1)}%`;
    case 'pct0': return `${Math.round(v)}%`;
    case 'signed': return v === 0 ? '0' : `${sign(v)}${Math.abs(v).toLocaleString()}`;
    case 'signed1': return `${sign(v)}${Math.abs(v).toFixed(1)}`;
    case 'compact': return v < 0 ? `−${formatCompact(-v)}` : formatCompact(v);
    case 'lakh': return `${(v / 100000).toFixed(1)}L`;
    case 'intDash': return v === 0 ? '–' : v.toLocaleString();
    case 'pp': return `${sign(v) || '+'}${Math.abs(v).toFixed(1)} pp`;
    case 'result': return v ? opts.won ?? 'Won' : opts.lost ?? 'Lost';
    default: return v.toLocaleString();
  }
}

/** The number a compact row shows for its section. */
export function primaryCell(r: { value: number | null; valueFormat: ValueFormat; valueText?: string; extra?: SummaryCell[] }, col = 0): SummaryCell {
  const cols: SummaryCell[] = [{ value: r.value, format: r.valueFormat, text: r.valueText }, ...(r.extra ?? [])];
  return cols[col] ?? cols[0];
}
