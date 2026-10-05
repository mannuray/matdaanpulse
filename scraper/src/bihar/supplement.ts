/**
 * Seats a statistical report publishes without votes (Bihar 2015: 195, 210, 229 have blank vote columns) are filled
 * from the archived official ECI results pages (eciresults.nic.in, via the Wayback Machine). They are recorded in the
 * committed scraper/data/bihar/supplement.json and cross-checked against the Constituency Data Summary like any seat.
 */
import * as cheerio from 'cheerio';
import type { RawElection, SeatSummary, SeatType } from './types';
import { partyKey } from './party-map';

export interface SupplementCandidate { name: string; party: string; votes: number }
export interface SupplementSeat { constNo: number; source: string; candidates: SupplementCandidate[] }
/** supplement.json: year → seats. */
export type Supplement = Record<string, SupplementSeat[]>;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The Candidate / Party / Votes table of an eciresults.nic.in "Constituencywise-All Candidates" page. */
export function parseEciResultsHtml(html: string): SupplementCandidate[] {
  const $ = cheerio.load(html);
  const header = $('tr').filter((_, tr) => $(tr).children('th,td').map((__, c) => clean($(c).text())).get().join('|') === 'Candidate|Party|Votes').first();
  if (!header.length) throw new Error('ECI results page: results table not found');
  const out: SupplementCandidate[] = [];
  header.nextAll('tr').each((_, tr) => {
    const cells = $(tr).find('td').map((__, td) => clean($(td).text())).get();
    if (cells.length >= 3 && /^\d+$/.test(cells[2])) out.push({ name: cells[0], party: cells[1], votes: Number(cells[2]) });
  });
  if (!out.length) throw new Error('ECI results page: results table is empty');
  return out;
}

/** Adds each supplement seat the report lacks; candidate parties map full name → that year's abbreviation. */
export function applySupplement(raw: RawElection, seats: SupplementSeat[]): RawElection {
  const added = seats.filter(s => !raw.seats.some(x => x.constNo === s.constNo)).map(s => {
    const m = raw.summaries.find(x => x.constNo === s.constNo);
    if (!m) throw new Error(`supplement seat ${s.constNo}: not in the Constituency Data Summary`);
    const nota = s.candidates.find(c => /^none of the above$/i.test(c.party));
    const candidates = s.candidates.filter(c => c !== nota).map((c, i) => {
      const abbr = /^independent$/i.test(c.party) ? 'IND' : raw.parties.find(p => partyKey(p.name) === partyKey(c.party))?.abbr;
      if (!abbr) throw new Error(`supplement seat ${s.constNo}: party "${c.party}" is not in the ${raw.year} party list`);
      return { serial: i + 1, name: c.name, sex: null, age: null, party: abbr, general: c.votes, postal: 0, total: c.votes };
    });
    const sum = candidates.reduce((a, c) => a + c.total, 0) + (nota?.votes ?? 0);
    return { constNo: s.constNo, acName: m.name, type: m.type, electors: m.electors, nota: nota ? nota.votes : null, totalVotes: sum, candidates };
  });
  return { ...raw, seats: [...raw.seats, ...added].sort((a, b) => a.constNo - b.constNo) };
}

/** Leaves out seats an election's report does not cover (Tamil Nadu 2016: two seats polled months later). */
export function withoutSeats(raw: RawElection, constNos: number[]): RawElection {
  if (!constNos.length) return raw;
  const drop = new Set(constNos);
  return { ...raw, seats: raw.seats.filter(s => !drop.has(s.constNo)), summaries: raw.summaries.filter(s => !drop.has(s.constNo)) };
}

/** A seat ECI's Constituency Data Summary leaves out: what the detailed seat cannot tell, sourced (summary-fixes.json `missing`). */
export interface MissingSummary { name: string; type: SeatType; voters: number; pollDate: string; reason: string }

/**
 * Builds the summary of each seat the report's Constituency Data Summary lacks (UP 2017: 11 of 403) from its Detailed
 * Results (electors, contested, valid votes, winner, runner-up, margin) and a sourced fix (type, voters, poll date).
 */
export function withMissingSummaries(raw: RawElection, missing: Record<number, MissingSummary>): RawElection {
  const added: SeatSummary[] = [];
  for (const [no, m] of Object.entries(missing)) {
    const constNo = Number(no);
    if (raw.summaries.some(s => s.constNo === constNo)) continue;
    const seat = raw.seats.find(s => s.constNo === constNo);
    if (!seat) throw new Error(`summary fix: seat ${constNo} is not in the Detailed Results`);
    const [w, r] = [...seat.candidates].sort((a, b) => b.total - a.total);
    added.push({ constNo, name: m.name, type: m.type, electors: seat.electors, voters: m.voters, contested: seat.candidates.length,
      // Valid votes for the candidates; NOTA apart (the summaries' convention when they list NOTA).
      totalValid: seat.candidates.reduce((a, c) => a + c.total, 0), nota: seat.nota,
      pollDate: m.pollDate, winner: { party: w.party, name: w.name, votes: w.total }, runnerUp: { party: r.party, name: r.name, votes: r.total }, margin: w.total - r.total });
  }
  return added.length ? { ...raw, summaries: [...raw.summaries, ...added].sort((a, b) => a.constNo - b.constNo) } : raw;
}
