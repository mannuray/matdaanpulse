/**
 * Seats a statistical report publishes without votes (Bihar 2015: 195, 210, 229 have blank vote columns) are filled
 * from the archived official ECI results pages (eciresults.nic.in, via the Wayback Machine). They are recorded in the
 * committed scraper/data/bihar/supplement.json and cross-checked against the Constituency Data Summary like any seat.
 */
import * as cheerio from 'cheerio';
import type { RawElection } from './types';
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
