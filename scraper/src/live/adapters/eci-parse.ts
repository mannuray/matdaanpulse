/**
 * Pure parsers for ECI "ResultAcGen" results-site pages (statewise list, candidate-wise, party-wise): no fetching, no env.
 * Used by the live eci-web adapter, the legacy src/adapters/eci-vs-adapter.ts and the photo tools.
 */
import * as cheerio from 'cheerio';

export interface ConstituencySummary {
  name: string;
  constNo: number;
  winnerName: string;
  winnerParty: string;
  runnerUpName: string;
  runnerUpParty: string;
  margin: number;
  rounds: string;
  status: string;
}

export interface CandidateDetail {
  name: string;
  party: string;
  votes: number;
  margin: number; // positive for winner, negative for others
  status: 'won' | 'lost' | '';
  /** The candidate's photo on the ECI site (results.eci.gov.in/…/candprofile/…), or null. */
  photo: string | null;
}

/** Columns in a statewise list row: name, no, winner, winner party, runner-up, runner-up party, margin, rounds, status */
const LIST_ROW_CELLS = 9;

/** Parse one statewise constituency-list page. */
export function parseConstituencyListPage(html: string): ConstituencySummary[] {
  const $ = cheerio.load(html);
  const results: ConstituencySummary[] = [];

  $('table.table-striped tbody tr').each((_i, row) => {
    const cells = $(row).children('td');
    // We read cells[0..8]; skip header/short rows instead of reading undefined cells
    if (cells.length < LIST_ROW_CELLS) return;

    const name = $(cells[0]).text().trim();
    const constNo = parseInt($(cells[1]).text().trim(), 10);
    if (!name || isNaN(constNo)) return;

    const winnerName = $(cells[2]).text().trim();
    // Party is inside a nested table
    const winnerParty = $(cells[3]).find('td').first().text().trim();
    const runnerUpName = $(cells[4]).text().trim();
    const runnerUpParty = $(cells[5]).find('td').first().text().trim();
    const margin = parseInt($(cells[6]).text().trim(), 10) || 0;
    const rounds = $(cells[7]).text().trim();
    const status = $(cells[8]).text().trim();

    results.push({
      name,
      constNo,
      winnerName,
      winnerParty,
      runnerUpName,
      runnerUpParty,
      margin,
      rounds,
      status,
    });
  });

  return results;
}

/** Parse one candidate-wise detail page. */
export function parseCandidateDetailPage(html: string): CandidateDetail[] {
  const $ = cheerio.load(html);
  const candidates: CandidateDetail[] = [];

  $('.cand-box').each((_i, box) => {
    const name = $(box).find('.nme-prty h5').text().trim();
    const party = $(box).find('.nme-prty h6').text().trim();
    const statusEl = $(box).find('.status');
    const rawStatus = statusEl.find('div').first().text().trim().toLowerCase();
    const statusText: CandidateDetail['status'] = rawStatus === 'won' || rawStatus === 'lost' ? rawStatus : '';

    // Votes and margin are in the second div inside .status
    const voteText = statusEl.find('div').eq(1).text().trim();
    // Format: "106262 (+ 35175)" or "71087 ( -35175)"
    const voteMatch = voteText.match(/^([\d,]+)/);
    const votes = voteMatch ? parseInt(voteMatch[1].replace(/,/g, ''), 10) : 0;

    const marginMatch = voteText.match(/\(\s*([+-])\s*([\d,]+)\s*\)/);
    const margin = marginMatch
      ? (marginMatch[1] === '+' ? 1 : -1) * parseInt(marginMatch[2].replace(/,/g, ''), 10)
      : 0;

    // Only an absolute candidate photo; NOTA's box shows a relative placeholder (img/nota.jpg).
    const src = $(box).find('figure img').attr('src')?.trim() ?? '';
    const photo = /^https?:\/\//i.test(src) ? src : null;

    candidates.push({ name, party, votes, margin, status: statusText, photo });
  });

  return candidates;
}

/** Party-wise result page: "Full Name - ABBR", Won, Leading (review §4). */
export function parsePartywisePage(html: string): { party: string; won: number; leading: number }[] {
  const $ = cheerio.load(html);
  const out: { party: string; won: number; leading: number }[] = [];
  $('table.table tbody tr').each((_i, row) => {
    const cells = $(row).children('td');
    if (cells.length < 3) return;
    const party = $(cells[0]).text().trim();
    const won = parseInt($(cells[1]).text().trim(), 10), leading = parseInt($(cells[2]).text().trim(), 10);
    if (party && !isNaN(won) && !isNaN(leading)) out.push({ party, won, leading });
  });
  return out;
}
