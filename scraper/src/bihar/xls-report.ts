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
  const C = { no: col('AC NO.'), ac: col('AC NAME'), name: col('CANDIDATE NAME'), sex: col('SEX', 'GENDER'), age: col('AGE'),
    party: col('PARTY'), general: col('GENERAL'), postal: col('POSTAL'), total: col('TOTAL'), electors: col('TOTAL ELECTORS') };
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
    if (!cur) {
      const ac = splitAcName(text(r[C.ac]));
      cur = { constNo, acName: ac.name, type: ac.type, electors: num(r[C.electors]), candidates: [], nota: null, totalVotes: 0 };
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
  if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row`);
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

export function parsePartyListRows(rows: Row[]): PartyListEntry[] {
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
  const out: PartyPerformance[] = [];
  for (const r of rows) {
    if (!/^\d+$/.test(text(r[0])) || blank(r[1])) continue;
    out.push({ abbr: text(r[1]), contested: num(r[2]), won: num(r[3]), votes: num(r[5]) });
  }
  if (!out.length) throw new Error('Performance: no rows');
  return out;
}
