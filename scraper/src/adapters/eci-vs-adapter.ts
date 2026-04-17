import * as cheerio from 'cheerio';

const BASE_URL = process.env.ECI_VS_BASE_URL || 'https://results.eci.gov.in/ResultAcGenNov2025';

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
}

/** Normalize constituency name to an ID: BR_VS_131_KALYANPUR (includes constNo for uniqueness) */
export function makeConstId(name: string, constNo: number): string {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `BR_VS_${constNo}_${normalized}`;
}

/** Fetch with retry and delay */
async function fetchWithRetry(url: string, retries = 3, delayMs = 500): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

/** Scrape all 13 statewise pages to get constituency list */
export async function fetchConstituencyList(): Promise<ConstituencySummary[]> {
  const results: ConstituencySummary[] = [];
  const totalPages = 13;

  for (let page = 1; page <= totalPages; page++) {
    const url = `${BASE_URL}/statewiseS04${page}.htm`;
    console.log(`Fetching page ${page}/${totalPages}: ${url}`);
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    $('table.table-striped tbody tr').each((_i, row) => {
      const cells = $(row).children('td');
      if (cells.length < 7) return; // skip header rows

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

    // Rate limiting
    if (page < totalPages) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

/** Scrape candidate-level detail for a single constituency */
export async function fetchConstituencyDetail(constNo: number): Promise<CandidateDetail[]> {
  const url = `${BASE_URL}/candidateswise-S04${constNo}.htm`;
  const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);

  const candidates: CandidateDetail[] = [];

  $('.cand-box').each((_i, box) => {
    const name = $(box).find('.nme-prty h5').text().trim();
    const party = $(box).find('.nme-prty h6').text().trim();
    const statusEl = $(box).find('.status');
    const statusText = statusEl.find('div').first().text().trim().toLowerCase() as 'won' | 'lost' | '';

    // Votes and margin are in the second div inside .status
    const voteText = statusEl.find('div').eq(1).text().trim();
    // Format: "106262 (+ 35175)" or "71087 ( -35175)"
    const voteMatch = voteText.match(/^([\d,]+)/);
    const votes = voteMatch ? parseInt(voteMatch[1].replace(/,/g, ''), 10) : 0;

    const marginMatch = voteText.match(/\(\s*([+-])\s*([\d,]+)\s*\)/);
    const margin = marginMatch
      ? (marginMatch[1] === '+' ? 1 : -1) * parseInt(marginMatch[2].replace(/,/g, ''), 10)
      : 0;

    candidates.push({ name, party, votes, margin, status: statusText });
  });

  return candidates;
}
