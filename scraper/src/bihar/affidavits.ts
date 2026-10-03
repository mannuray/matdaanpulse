/**
 * Winners' affidavits (criminal cases, assets, liabilities, education) from MyNeta (ADR) "show_winners" pages, matched
 * to our winners by seat name and winner name, emitted as a run-once fill-only seed (spec §7, Tier B).
 */
import * as cheerio from 'cheerio';
import { parseRupeeAmount } from '../adapters/myneta-adapter';
import { runOnce } from '../seed-run-once';
import { normName, similarity } from './names';
import { q } from './sql';

export const MYNETA_SLUGS: Record<number, string> = { 2010: 'bih2010', 2015: 'bihar2015', 2020: 'bihar2020', 2025: 'Bihar2025' };
export const winnersUrl = (slug: string) => `https://myneta.info/${slug}/index.php?action=show_winners&sort=default`;

export interface WinnerRow { name: string; constituency: string; party: string; criminalCases: number | null; education: string | null; assets: number | null; liabilities: number | null; sourceUrl: string }
export interface Affidavit { candidateId: string; constNo: number; criminalCases: number | null; assets: number | null; liabilities: number | null; education: string | null; source: string }
export interface WinnerSeat { constNo: number; name: string; winner: { candidateId: string; name: string } }

const MIN_NAME_MATCH = 0.5;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const money = (s: string): number | null => (!s || /^nil$/i.test(s) || !/\d/.test(s) ? null : parseRupeeAmount(s));

export function parseWinners(html: string, sourceUrl: string): WinnerRow[] {
  const $ = cheerio.load(html);
  const out: WinnerRow[] = [];
  $('table').each((_, table) => {
    const header = $(table).find('tr').first().children('th,td').map((__, c) => clean($(c).text())).get();
    if (header[0] !== 'Sno' || header[1] !== 'Candidate') return;
    const col = (label: string) => header.findIndex(h => h.toLowerCase().startsWith(label.toLowerCase()));
    const C = { name: col('Candidate'), seat: col('Constituency'), party: col('Party'), cases: col('Criminal Case'), edu: col('Education'), assets: col('Total Assets'), liab: col('Liabilities') };
    $(table).find('tr').slice(1).each((__, tr) => {
      const cells = $(tr).children('td');
      if (cells.length < header.length) return;
      const text = (i: number) => clean(cells.eq(i).text());
      const href = cells.eq(C.name).find('a[href*="candidate_id="]').attr('href');
      if (!href) return;
      const cases = text(C.cases);
      out.push({
        name: text(C.name), constituency: text(C.seat), party: text(C.party),
        criminalCases: /^\d+$/.test(cases) ? Number(cases) : null,
        education: text(C.edu) || null,
        assets: money(text(C.assets)), liabilities: money(text(C.liab)),
        sourceUrl: new URL(href, sourceUrl).toString(),
      });
    });
  });
  return out;
}

/** Seat name without reservation or district tags ("RAGHOPUR ( VAISHALI )", "AGIAON (SC)"), letters only. */
const seatKey = (s: string) => normName(s.replace(/\([^)]*\)/g, ' ')).replace(/\s/g, '');
/** A seat name this close (Dice) to ours counts as the same seat ("KUMHRARH" = "Kumhrar"). */
const SEAT_MATCH = 0.8;

export function matchWinners(rows: WinnerRow[], seats: WinnerSeat[]): { matched: Affidavit[]; unmatched: string[] } {
  const matched: Affidavit[] = [];
  const unmatched: string[] = [];
  for (const r of rows) {
    if (/\bBYE[\s-]*ELECTION\b/i.test(r.constituency)) continue; // a by-election winner, not the general election's
    const key = seatKey(r.constituency);
    let pool = seats.filter(s => seatKey(s.name) === key);
    if (!pool.length) pool = seats.filter(s => similarity(seatKey(s.name), key) >= SEAT_MATCH);
    if (!pool.length) { unmatched.push(`${r.constituency}: ${r.name} (no such seat in our data)`); continue; }
    // Seats can share a name (two Pipras, two Kalyanpurs): the winner's name decides.
    const best = pool.map(s => ({ s, sim: similarity(r.name, s.winner.name) })).sort((a, b) => b.sim - a.sim)[0];
    if (best.sim < MIN_NAME_MATCH) { unmatched.push(`${r.constituency}: ${r.name} (winner in our data: ${pool.map(p => p.winner.name).join(' / ')})`); continue; }
    const seat = best.s;
    matched.push({ candidateId: seat.winner.candidateId, constNo: seat.constNo, criminalCases: r.criminalCases, assets: r.assets, liabilities: r.liabilities, education: r.education, source: r.sourceUrl });
  }
  return { matched, unmatched };
}

export interface AffidavitsSeedOpts { seedName: string; label: string }
export const BIHAR_AFFIDAVITS: AffidavitsSeedOpts = { seedName: 'seed_bihar_affidavits', label: 'Bihar VS 2010-2025' };

export function emitAffidavitsSeed(byYear: Record<string, Affidavit[]>, opts: AffidavitsSeedOpts = BIHAR_AFFIDAVITS): string {
  const rows = Object.values(byYear).flat().map(a => `  (${q(a.candidateId)}, ${q(a.criminalCases)}, ${q(a.assets)}, ${q(a.liabilities)}, ${q(a.education)})`);
  const values = `FROM (VALUES\n${rows.join(',\n')}\n) AS v(id, criminal_cases, assets, liabilities, education)`;
  return runOnce({
    name: opts.seedName,
    comment: [
      `Run once (seed_runs). ${opts.label} winners' affidavits from MyNeta (ADR), generated by`,
      'scraper/src/bihar/affidavits-cli.ts. Fill-only: values an admin entered are never overwritten.',
    ],
    body: rows.length ? [
      'UPDATE candidates c SET criminal_cases = COALESCE(c.criminal_cases, v.criminal_cases::smallint),',
      '  assets = COALESCE(c.assets, v.assets::bigint), liabilities = COALESCE(c.liabilities, v.liabilities::bigint)',
      `${values}\nWHERE c.id = v.id::uuid;`,
      'UPDATE persons p SET education = COALESCE(p.education, v.education)',
      `${values}\nJOIN candidates c ON c.id = v.id::uuid\nWHERE p.id = c.person_id;`,
    ] : [],
  }).join('\n');
}
