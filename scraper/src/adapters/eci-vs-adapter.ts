import { parseCandidateDetailPage, parseConstituencyListPage, type CandidateDetail, type ConstituencySummary } from '../live/adapters/eci-parse';

// The page parsers live in src/live/adapters/eci-parse.ts; re-exported for existing importers.
export { parseCandidateDetailPage, parseConstituencyListPage, parsePartywisePage, type CandidateDetail, type ConstituencySummary } from '../live/adapters/eci-parse';

const DEFAULT_BASE_URL = process.env.ECI_VS_BASE_URL || 'https://results.eci.gov.in/ResultAcGenNov2025';

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
