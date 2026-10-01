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
