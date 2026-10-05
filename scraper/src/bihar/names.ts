import { normName } from '../live/adapters/eci-mapping';
import type { SeatType, Sex } from './types';

export { normName };

/** "RAMNAGAR (SC)" / "Ramnagar (SC) (SC)" → name + type; no marker → type null. */
export function splitAcName(raw: string): { name: string; type: SeatType | null } {
  let s = raw.replace(/\s+/g, ' ').trim();
  let type: SeatType | null = null;
  for (let m = /\s*\((GEN|SC|ST)\)\s*$/i.exec(s); m; m = /\s*\((GEN|SC|ST)\)\s*$/i.exec(s)) {
    type = m[1].toUpperCase() as SeatType;
    s = s.slice(0, m.index).trim();
  }
  // Some reports write the reservation without brackets: "Mahadewa S.C", "Machhlishahr S.C.".
  const dotted = /\s+(S\.C|S\.T)\.?$/i.exec(s);
  if (dotted && !type) { type = dotted[1].replace('.', '').toUpperCase() as SeatType; s = s.slice(0, dotted.index).trim(); }
  return { name: s, type };
}

export function stripSerial(raw: string): { serial: number | null; name: string } {
  const m = /^\s*(\d+)\s+(.*?)\s*$/.exec(raw);
  return m ? { serial: Number(m[1]), name: m[2] } : { serial: null, name: raw.trim() };
}

/** All-caps names (2010/2015 PDFs) become Title Case; mixed-case names are kept as ECI wrote them. */
export function displayName(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').replace(/\s*Father[’']s Name\s*:-.*$/i, '').trim();
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s.(\-'])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

export function sexOf(v: unknown): Sex | null {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'M' || s === 'MALE') return 'M';
  if (s === 'F' || s === 'FEMALE') return 'F';
  return 'O';
}

const MONTHS: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

export function isoDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (m && MONTHS[m[2].toUpperCase()]) return `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}`;
  throw new Error(`unrecognised date: ${raw}`);
}

/** Dice coefficient over character bigrams of the normalised names (spaces removed). */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = normName(s).replace(/\s/g, '');
    const out = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const ga = grams(a), gb = grams(b);
  let inter = 0, total = 0;
  for (const [g, n] of ga) { inter += Math.min(n, gb.get(g) ?? 0); total += n; }
  for (const n of gb.values()) total += n;
  return total === 0 ? 0 : (2 * inter) / total;
}
