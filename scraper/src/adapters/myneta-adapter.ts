/**
 * MyNeta.info scraper adapter for candidate affidavit data.
 *
 * Scrapes candidate lists and individual affidavit pages from myneta.info (ADR).
 * Reusable for any state election — pass the election slug (e.g. "Bihar2025").
 */
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MyNetaCandidate {
  name: string;
  constituency: string;
  constituencyId: number;
  party: string;
  url: string; // relative: candidate.php?candidate_id=N
  candidateId: number;
  /** Summary data available on list page */
  criminalCases: number;
  education: string;
  age: number;
  totalAssets: string; // raw text, e.g. "Rs 9,07,55,000\n ~9 Crore+"
  liabilities: string;
}

export interface AffidavitData {
  criminal_cases: number;
  serious_ipc: boolean;
  ipc_sections: string[]; // e.g. ["341","323","354"]
  total_assets: number; // in INR
  movable_assets: number;
  immovable_assets: number;
  liabilities: number;
  education: string;
  profession: string;
  age: number;
  source_url: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHE_DIR = path.join(__dirname, '..', 'cache', 'myneta');

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cachePathFor(slug: string, type: string, id: number): string {
  return path.join(CACHE_DIR, `${slug}_${type}_${id}.html`);
}

function readCache(filePath: string): string | null {
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
  return null;
}

function writeCache(filePath: string, html: string): void {
  ensureCacheDir();
  fs.writeFileSync(filePath, html, 'utf-8');
}

async function fetchWithRetry(url: string, retries = 3, delayMs = 500): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ElectionTracker/1.0)',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = delayMs * Math.pow(2, i);
      console.log(`  Retry ${i + 1}/${retries} after ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error('unreachable');
}

async function fetchCached(
  url: string,
  cachePath: string,
  delayMs = 500,
): Promise<string> {
  const cached = readCache(cachePath);
  if (cached) return cached;

  await new Promise((r) => setTimeout(r, delayMs)); // rate limit
  const html = await fetchWithRetry(url);
  writeCache(cachePath, html);
  return html;
}

/** Parse "Rs 9,07,55,000" or "9,07,55,000 ~9 Crore+" → 90755000 */
export function parseRupeeAmount(text: string): number {
  if (!text) return 0;
  // Extract the first Rs-prefixed or standalone number: "Rs 9,72,264  9 Lacs+"
  // We want only the first comma-separated number, ignoring "9 Lacs+" suffix
  const match = text.match(/(?:Rs\.?\s*)?([\d,]+)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ''), 10) || 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the total number of constituencies from the main election page.
 * Scrapes all constituency links from the index page.
 */
export async function fetchConstituencyIds(
  slug: string,
): Promise<{ id: number; name: string }[]> {
  const baseUrl = `https://www.myneta.info/${slug}/`;
  const cachePath = path.join(CACHE_DIR, `${slug}_index.html`);
  const html = await fetchCached(baseUrl, cachePath, 0);
  const $ = cheerio.load(html);

  const constituencies: { id: number; name: string }[] = [];
  $('a[href*="constituency_id="]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/constituency_id=(\d+)/);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const name = $(el).text().trim();
    if (name && !constituencies.some((c) => c.id === id)) {
      constituencies.push({ id, name });
    }
  });

  return constituencies.sort((a, b) => a.id - b.id);
}

/**
 * Fetch candidate list for a single constituency.
 */
export async function fetchCandidateList(
  slug: string,
  constituencyId: number,
): Promise<MyNetaCandidate[]> {
  const url = `https://www.myneta.info/${slug}/index.php?action=show_candidates&constituency_id=${constituencyId}`;
  const cachePath = cachePathFor(slug, 'const', constituencyId);
  const html = await fetchCached(url, cachePath);
  const $ = cheerio.load(html);

  const candidates: MyNetaCandidate[] = [];

  // Constituency name from breadcrumb/heading
  const heading = $('h3, h2')
    .filter((_i, el) => $(el).text().includes('('))
    .first()
    .text()
    .trim();
  const constName = heading.split('(')[0]?.trim() || `Constituency ${constituencyId}`;

  // Candidate rows in table
  $('table tr').each((_i, row) => {
    const cells = $(row).children('td');
    if (cells.length < 7) return;

    const sno = $(cells[0]).text().trim();
    if (!/^\d+$/.test(sno)) return; // skip header

    const nameLink = $(cells[1]).find('a');
    const name = nameLink.text().replace(/\*\*.*?\*\*/g, '').trim();
    const href = nameLink.attr('href') || '';
    const candidateIdMatch = href.match(/candidate_id=(\d+)/);
    if (!candidateIdMatch) return;

    const candidateId = parseInt(candidateIdMatch[1], 10);
    const party = $(cells[2]).text().trim();
    const criminalCases = parseInt($(cells[3]).text().trim(), 10) || 0;
    const education = $(cells[4]).text().trim();
    const age = parseInt($(cells[5]).text().trim(), 10) || 0;
    const totalAssets = $(cells[6]).text().trim();
    const liabilities = cells.length > 7 ? $(cells[7]).text().trim() : '';

    candidates.push({
      name,
      constituency: constName,
      constituencyId,
      party,
      url: href,
      candidateId,
      criminalCases,
      education,
      age,
      totalAssets,
      liabilities,
    });
  });

  return candidates;
}

/**
 * Fetch detailed affidavit data from an individual candidate page.
 */
export async function fetchCandidateDetail(
  slug: string,
  candidateId: number,
): Promise<AffidavitData> {
  const url = `https://www.myneta.info/${slug}/candidate.php?candidate_id=${candidateId}`;
  const cachePath = cachePathFor(slug, 'cand', candidateId);
  const html = await fetchCached(url, cachePath);
  const $ = cheerio.load(html);

  const fullText = $.text();

  // --- Criminal cases ---
  let criminalCases = 0;
  let seriousIpc = false;
  const ipcSections: string[] = [];

  // "Number of Criminal Cases: 1" or "Number of Criminal Cases: 0"
  const caseMatch = fullText.match(/Number of Criminal Cases\s*:\s*(\d+)/i);
  if (caseMatch) {
    criminalCases = parseInt(caseMatch[1], 10) || 0;
  }

  // IPC sections from case details
  const ipcMatches = fullText.match(/IPC Section[s]?[-:\s]*([\d,\s/]+)/gi);
  if (ipcMatches) {
    for (const m of ipcMatches) {
      const sections = m.replace(/IPC Section[s]?[-:\s]*/i, '').match(/\d+/g);
      if (sections) ipcSections.push(...sections);
    }
  }

  // Serious IPC: 302(murder), 307(attempt murder), 376(rape), 395(dacoity), 420(fraud)
  const seriousSections = ['302', '307', '376', '395', '420', '498', '354'];
  seriousIpc = ipcSections.some((s) => seriousSections.includes(s));

  // --- Assets ---
  let movableAssets = 0;
  let immovableAssets = 0;
  let totalAssets = 0;
  let liabilities = 0;

  // Find values from tables by scanning all table rows
  $('table tr').each((_i, row) => {
    const cells = $(row).children('td');
    if (cells.length < 2) return;
    const label = $(cells[0]).text().trim().toLowerCase();
    const value = $(cells[1]).text().trim();

    // Movable: "Gross Total Value (as per Affidavit)"
    if (label.includes('gross total value') && !movableAssets) {
      movableAssets = parseRupeeAmount(value);
    }
    // Immovable: "Total Current Market Value of (i) to (v) (as per Affidavit)"
    if (label.includes('total current market value') && !immovableAssets) {
      immovableAssets = parseRupeeAmount(value);
    }
    // Liabilities: "Grand Total of Liabilities (as per affidavit)"
    if (label.includes('grand total of liabilities') && !liabilities) {
      liabilities = parseRupeeAmount(value);
    }
  });

  totalAssets = movableAssets + immovableAssets;

  // Fallback: try summary "Assets:" / "Liabilities:" rows if tables didn't have data
  if (!totalAssets) {
    $('table tr').each((_i, row) => {
      const cells = $(row).children('td');
      if (cells.length < 2) return;
      const label = $(cells[0]).text().trim().toLowerCase();
      const value = $(cells[1]).text().trim();
      if (label === 'assets:' && !totalAssets) {
        totalAssets = parseRupeeAmount(value);
      }
      if (label === 'liabilities:' && !liabilities) {
        liabilities = parseRupeeAmount(value);
      }
    });
  }

  // --- Education ---
  let education = '';
  // Try "Category: 12th Pass" first (common on detail pages)
  const eduMatch = fullText.match(/Category\s*:\s*([^\n]+)/i);
  if (eduMatch) {
    education = eduMatch[1].trim();
  }
  // Fallback: "Education: Graduate"
  if (!education) {
    const eduMatch2 = fullText.match(/Education\s*:\s*([^\n]+)/i);
    if (eduMatch2) education = eduMatch2[1].trim();
  }

  // --- Profession ---
  let profession = '';
  const profMatch = fullText.match(/Self Profession\s*:\s*([^\n]+)/i);
  if (profMatch) {
    profession = profMatch[1].trim();
  }

  // --- Age ---
  let age = 0;
  const ageMatch = fullText.match(/Age\s*:\s*(\d+)/i);
  if (ageMatch) {
    age = parseInt(ageMatch[1], 10) || 0;
  }

  return {
    criminal_cases: criminalCases,
    serious_ipc: seriousIpc,
    ipc_sections: [...new Set(ipcSections)],
    total_assets: totalAssets,
    movable_assets: movableAssets,
    immovable_assets: immovableAssets,
    liabilities,
    education,
    profession,
    age,
    source_url: url,
  };
}
