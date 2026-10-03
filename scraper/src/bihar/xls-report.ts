import type { PartyListEntry, PartyPerformance, RawSeat, Recognition, SeatSummary, SeatType, SummaryPick } from './types';
import { isoDate, sexOf, splitAcName, stripSerial } from './names';

export type Row = unknown[];

const cell = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
const text = (v: unknown): string => String(cell(v) ?? '');
const blank = (v: unknown): boolean => { const c = cell(v); return c === null || c === undefined || c === ''; };
const num = (v: unknown): number => {
  if (blank(v)) return 0;
  const c = cell(v);
  const n = typeof c === 'number' ? c : Number(String(c).replace(/,/g, ''));
  if (!Number.isFinite(n)) throw new Error(`not a number: ${String(v)}`);
  return n;
};
const lastNum = (r: Row): number => {
  for (let i = r.length - 1; i >= 0; i--) if (!blank(r[i]) && Number.isFinite(Number(cell(r[i])))) return Number(cell(r[i]));
  throw new Error(`no number in row: ${JSON.stringify(r)}`);
};

export function parseDetailedRows(rows: Row[]): RawSeat[] {
  const hi = rows.findIndex(r => r.some(c => text(c).toUpperCase() === 'CANDIDATE NAME'));
  if (hi < 0) throw new Error('Detailed Results: header row not found');
  const h = rows[hi].map(c => text(c).toUpperCase());
  const col = (...names: string[]): number => {
    const i = h.findIndex(x => names.includes(x));
    if (i < 0) throw new Error(`Detailed Results: missing column ${names[0]}`);
    return i;
  };
  // Header spellings differ by year/state: "AC NO." / "Constituency No.", "PARTY" / "Party Name", …
  const C = { no: col('AC NO.', 'CONSTITUENCY NO.'), ac: col('AC NAME', 'CONSTITUENCY NAME'), name: col('CANDIDATE NAME'),
    sex: col('SEX', 'GENDER', 'CANDIDATE SEX'), age: col('AGE', 'CANDIDATE AGE'), party: col('PARTY', 'PARTY NAME'),
    general: col('GENERAL', 'VALID VOTES POLLED IN GENERAL'), postal: col('POSTAL', 'VALID VOTES POLLED IN POSTAL'),
    total: col('TOTAL', 'TOTAL VALID VOTES'), electors: col('TOTAL ELECTORS') };
  // Flat files carry the seat's total in a "Total Votes" column; summing the parsed rows instead would let the
  // turnout-row cross-check compare a number with itself.
  const seatTotal = h.indexOf('TOTAL VOTES');
  // Most reports close each seat with a TURNOUT row; flat ones (Puducherry 2016) don't, so seats end when the number changes.
  const closesWithTurnout = rows.slice(hi + 1).some(r => text(r[0]).toUpperCase().replace(/\s/g, '').startsWith('TURNOUT'));
  const close = (seat: RawSeat) => {
    if (seatTotal < 0) seat.totalVotes = seat.candidates.reduce((a, c) => a + c.total, 0) + (seat.nota ?? 0);
    seats.push(seat);
  };
  const seats: RawSeat[] = [];
  let cur: RawSeat | null = null;
  for (const r of rows.slice(hi + 1)) {
    if (text(r[0]).toUpperCase().replace(/\s/g, '').startsWith('TURNOUT')) {
      if (!cur) throw new Error('Detailed Results: TURNOUT row before any candidate');
      cur.totalVotes = num(r[C.total]);
      seats.push(cur);
      cur = null;
      continue;
    }
    if (blank(r[C.no])) continue;
    const constNo = num(r[C.no]);
    if (cur && !closesWithTurnout && cur.constNo !== constNo) { close(cur); cur = null; }
    if (!cur) {
      const ac = splitAcName(text(r[C.ac]));
      cur = { constNo, acName: ac.name, type: ac.type, electors: num(r[C.electors]), candidates: [], nota: null,
        totalVotes: !closesWithTurnout && seatTotal >= 0 ? num(r[seatTotal]) : 0 };
    } else if (cur.constNo !== constNo) {
      throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row before seat ${constNo}`);
    }
    const party = text(r[C.party]);
    const total = num(r[C.total]);
    if (party.toUpperCase() === 'NOTA') { cur.nota = total; continue; }
    const { serial, name } = stripSerial(text(r[C.name]));
    cur.candidates.push({ serial: serial ?? cur.candidates.length + 1, name, sex: sexOf(cell(r[C.sex])), age: blank(r[C.age]) ? null : num(r[C.age]),
      party, general: num(r[C.general]), postal: num(r[C.postal]), total });
  }
  if (cur && !closesWithTurnout) close(cur);
  else if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row`);
  return seats;
}

export function parseSummaryRows(rows: Row[]): SeatSummary {
  const label = text(rows[1]?.[3]);
  const m = /^(\d+)-(.+)-\(?(GEN|SC|ST)\)?$/i.exec(label);
  if (!m) throw new Error(`Summary: unrecognised constituency label "${label}"`);
  let section = '';
  const found: Record<string, number> = {};
  let pollDate = '';
  const picks: Record<string, SummaryPick> = {};
  let margin: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const head = text(r[0]);
    if (/^(I|II|III|IV|V|VI|VII)\./i.test(head)) section = head.toUpperCase();
    const lbl = text(r[1]);
    if (section.startsWith('I.') && /contested/i.test(lbl)) found.contested = lastNum(r);
    if (section.startsWith('II.') && /total/i.test(lbl)) found.electors = lastNum(r);
    if (section.startsWith('III. VOTERS') && /total/i.test(lbl)) found.voters = lastNum(r);
    if (section.startsWith('IV.') && /^7\.\s*total valid votes polled/i.test(lbl)) found.totalValid = lastNum(r);
    if (section.startsWith('IV.') && /'NOTA' \(INCLUDING POSTAL\)/i.test(lbl)) found.nota = lastNum(r);
    if (section.startsWith('VI.') && /^polling$/i.test(lbl)) pollDate = isoDate(text(rows[i + 1]?.[1]));
    if (section.startsWith('VII.') && /^(winner|runner-up)$/i.test(lbl)) picks[lbl.toLowerCase()] = { party: text(r[3]), name: text(r[4]), votes: num(r[5]) };
    if (section.startsWith('VII.') && /^margin$/i.test(lbl)) margin = num(r[3]);
  }
  for (const k of ['contested', 'electors', 'voters', 'totalValid']) if (found[k] === undefined) throw new Error(`Summary ${label}: ${k} not found`);
  if (!pollDate || !picks.winner || !picks['runner-up'] || margin === null) throw new Error(`Summary ${label}: dates/result not found`);
  return { constNo: Number(m[1]), name: m[2].trim(), type: m[3].toUpperCase() as SeatType, electors: found.electors, voters: found.voters,
    contested: found.contested, totalValid: found.totalValid, nota: found.nota ?? null, pollDate, winner: picks.winner, runnerUp: picks['runner-up'], margin };
}

export function recognitionOf(section: string): Recognition | null {
  const s = section.toUpperCase();
  if (s.startsWith('NATIONAL PARTIES')) return 'National';
  if (s.startsWith('STATE PARTIES')) return 'State';
  if (s.startsWith('REGISTERED')) return 'Unrecognised';
  return null;
}

const LETTER_TYPE: Record<string, Recognition> = { N: 'National', S: 'State' };
/** The header row of a "Party Type | Party Name | Party Abbreviation" (letter-typed) table, or -1. */
const letterHeader = (rows: Row[], second: string) =>
  rows.findIndex(r => text(r[0]).toUpperCase() === 'PARTY TYPE' && text(r[1]).toUpperCase() === 'PARTY NAME' && text(r[2]).toUpperCase().startsWith(second));

export function parsePartyListRows(rows: Row[]): PartyListEntry[] {
  const lh = letterHeader(rows, 'PARTY ABBREVIATION');
  if (lh >= 0) {
    // Puducherry 2016: one letter per row (N national, S state, anything else unrecognised), full name, abbreviation.
    const out = rows.slice(lh + 1).filter(r => !blank(r[1]) && !blank(r[2]))
      .map(r => ({ abbr: text(r[2]), name: text(r[1]), recognition: LETTER_TYPE[text(r[0]).toUpperCase()] ?? 'Unrecognised' as Recognition }));
    if (!out.length) throw new Error('Party list: no rows');
    return out;
  }
  const out: PartyListEntry[] = [];
  let rec: Recognition | null = null;
  for (const r of rows) {
    const first = text(r[0]);
    const sec = recognitionOf(first);
    if (sec) { rec = sec; continue; }
    if (/^\d+$/.test(first) && rec && !blank(r[1]) && !blank(r[2])) out.push({ abbr: text(r[1]), name: text(r[2]), recognition: rec });
  }
  if (!out.length) throw new Error('Party list: no rows');
  return out;
}

export function parsePerformanceRows(rows: Row[]): PartyPerformance[] {
  const lh = letterHeader(rows, 'CONTESTED');
  if (lh >= 0) {
    // Letter-typed layout keys parties by full name; performanceByAbbr maps them to abbreviations.
    const out = rows.slice(lh + 1).filter(r => !blank(r[1]) && text(r[1]).toUpperCase() !== 'NOTA' && !/^none of the above$/i.test(text(r[1])))
      .map(r => ({ abbr: text(r[1]), contested: num(r[2]), won: num(r[3]), votes: num(r[5]) }));
    if (!out.length) throw new Error('Performance: no rows');
    return out;
  }
  const out: PartyPerformance[] = [];
  for (const r of rows) {
    if (!/^\d+$/.test(text(r[0])) || blank(r[1]) || text(r[1]).toUpperCase() === 'NOTA') continue;
    out.push({ abbr: text(r[1]), contested: num(r[2]), won: num(r[3]), votes: num(r[5]) });
  }
  if (!out.length) throw new Error('Performance: no rows');
  return out;
}

/** Performance rows keyed by a full party name get that year's abbreviation (others are kept as they are). */
export function performanceByAbbr(perf: PartyPerformance[], parties: PartyListEntry[]): PartyPerformance[] {
  const key = (x: string) => x.replace(/\s+/g, ' ').trim().toUpperCase();
  const byName = new Map(parties.map(p => [key(p.name), p.abbr]));
  return perf.map(p => ({ ...p, abbr: byName.get(key(p.abbr)) ?? p.abbr }));
}
