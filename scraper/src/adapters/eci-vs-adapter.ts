import * as cheerio from 'cheerio';

const DEFAULT_BASE_URL = process.env.ECI_VS_BASE_URL || 'https://results.eci.gov.in/ResultAcGenNov2025';

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

export interface EciVsAdapterOptions {
  /** Results site root, e.g. https://results.eci.gov.in/ResultAcGenNov2025 (or the mock server). */
  baseUrl?: string;
  /** ECI state code used in page names, e.g. S04 (Bihar). */
  stateCode?: string;
  /** Number of statewise constituency-list pages to fetch. */
  totalPages?: number;
  /** Prefix for generated constituency IDs, e.g. BR_VS_. */
  constIdPrefix?: string;
  /** Delay between list-page fetches (ms). */
  pageDelayMs?: number;
  /** Log each page fetch. */
  verbose?: boolean;
}

/** Defaults: Bihar VS 2025 (state S04, 13 list pages, BR_VS_ IDs). */
export const BIHAR_2025_DEFAULTS: Required<EciVsAdapterOptions> = {
  baseUrl: DEFAULT_BASE_URL,
  stateCode: 'S04',
  totalPages: 13,
  constIdPrefix: 'BR_VS_',
  pageDelayMs: 300,
  verbose: true,
};

/** Columns in a statewise list row: name, no, winner, winner party, runner-up, runner-up party, margin, rounds, status */
const LIST_ROW_CELLS = 9;

/** Fetch with retry and delay */
export async function fetchWithRetry(url: string, retries = 3, delayMs = 500): Promise<string> {
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

/**
 * Scraper for ECI "ResultAcGen" Vidhan Sabha result pages. Used by the seed generator and
 * (via its page format) the live-simulation mock server. State, page count and ID prefix are
 * configurable; defaults are Bihar 2025.
 */
export class EciVsAdapter {
  private readonly opts: Required<EciVsAdapterOptions>;

  constructor(options: EciVsAdapterOptions = {}) {
    this.opts = { ...BIHAR_2025_DEFAULTS, ...options };
  }

  /** Normalize constituency name to an ID: BR_VS_131_KALYANPUR (includes constNo for uniqueness) */
  makeConstId(name: string, constNo: number): string {
    const normalized = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    return `${this.opts.constIdPrefix}${constNo}_${normalized}`;
  }

  /** Scrape all statewise pages to get the constituency list */
  async fetchConstituencyList(): Promise<ConstituencySummary[]> {
    const { baseUrl, stateCode, totalPages, pageDelayMs, verbose } = this.opts;
    const results: ConstituencySummary[] = [];

    for (let page = 1; page <= totalPages; page++) {
      const url = `${baseUrl}/statewise${stateCode}${page}.htm`;
      if (verbose) console.log(`Fetching page ${page}/${totalPages}: ${url}`);
      const html = await fetchWithRetry(url);
      results.push(...parseConstituencyListPage(html));

      // Rate limiting
      if (page < totalPages && pageDelayMs > 0) {
        await new Promise((r) => setTimeout(r, pageDelayMs));
      }
    }

    return results;
  }

  /** Scrape candidate-level detail for a single constituency */
  async fetchConstituencyDetail(constNo: number): Promise<CandidateDetail[]> {
    const url = `${this.opts.baseUrl}/candidateswise-${this.opts.stateCode}${constNo}.htm`;
    const html = await fetchWithRetry(url);
    return parseCandidateDetailPage(html);
  }
}

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

    candidates.push({ name, party, votes, margin, status: statusText });
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

// --- Backward-compatible function API (Bihar 2025 defaults; base URL from ECI_VS_BASE_URL) ---

const defaultAdapter = new EciVsAdapter();

export function makeConstId(name: string, constNo: number): string {
  return defaultAdapter.makeConstId(name, constNo);
}

export function fetchConstituencyList(): Promise<ConstituencySummary[]> {
  return defaultAdapter.fetchConstituencyList();
}

export function fetchConstituencyDetail(constNo: number): Promise<CandidateDetail[]> {
  return defaultAdapter.fetchConstituencyDetail(constNo);
}
