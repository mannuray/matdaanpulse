/** Form text → number for optional numeric fields: '' / whitespace / null → null, '0' → 0, '1,234' → 1234, junk → null. */
export function toOptionalNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = v.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Seat (constituency) number: a whole number of 1 or more, otherwise null. */
export function parseSeatNumber(v: string | number): number | null {
  const n = toOptionalNumber(v);
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
}

const LAKH = 1e5;
const CRORE = 1e7;

/**
 * Helper under the "Declared assets" field: "₹2,45,00,000 · ₹2.45 crore" (or "· ₹85 lakh"). It reads plain rupee text
 * (₹, commas and spaces ignored) and says nothing for empty or free text; the stored value is never reformatted.
 */
export function assetsHelper(v: string): string | null {
  const t = v.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  const rupees = `₹${n.toLocaleString('en-IN')}`;
  if (n >= CRORE) return `${rupees} · ₹${(n / CRORE).toFixed(2)} crore`;
  if (n >= LAKH) return `${rupees} · ₹${Number((n / LAKH).toFixed(2)).toLocaleString('en-IN')} lakh`;
  return rupees;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** A vote margin in Indian grouping: "+12,309" for a lead, "−90,652" for a gap, "—" when unknown. */
export function formatMargin(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—';
  const abs = Math.abs(m).toLocaleString('en-IN');
  return m > 0 ? `+${abs}` : m < 0 ? `−${abs}` : '0';
}
