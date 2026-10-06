import * as path from 'path';
import { execFileSync } from 'child_process';
import * as XLSX from 'xlsx';
import type { PartyListEntry, RawElection, Year } from './types';
import { STATES, electionOf, electionsOf, type StateCode } from './elections';
import { parseDetailedRows, parsePartyListRows, parsePerformanceRows, parseSummaryRows, performanceByAbbr, type Row } from './xls-report';
import { completeUncontested } from './uncontested';
import { sliceSeats } from './seat-range';
import { applyOcrFixes, ocrNormalise, type OcrFix } from './ocr';
import { parseDetailedText, parsePartyListText, parsePerformanceText, parseSummaryText, type SummaryFixes } from './pdf-report';
import * as fs from 'fs';
import { applySupplement, withMissingSummaries, withoutSeats, type MissingSummary, type Supplement } from './supplement';

export const dataDir = (s: StateCode) => path.resolve(__dirname, '../../data', STATES[s].slug);
export const rawDir = (s: StateCode) => path.resolve(__dirname, '../../data/raw', STATES[s].slug);
/** Party map and aliases, shared by every state (party ids are global). */
export const PARTY_DIR = path.resolve(__dirname, '../../data/parties');
/** Bihar's data directory (the Bihar-only leader, photo and party-profile tools use it). */
export const DATA_DIR = dataDir('BR');
export const RAW_DIR = rawDir('BR');

const sheets = (s: StateCode, file: string): Row[][] => namedSheets(s, file).map(x => x.rows);
const namedSheets = (s: StateCode, file: string): { name: string; rows: Row[] }[] => {
  const wb = XLSX.readFile(path.join(rawDir(s), file));
  return wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json<Row>(wb.Sheets[n], { header: 1, defval: null }) }));
};
/** A scanned report's OCR text (`ocr-cli.ts`, `<pdf>.ocr.txt`) when present, else pdftotext's layout text. */
const pdfText = (s: StateCode, file: string): string => {
  const ocr = path.join(rawDir(s), `${file}.ocr.txt`);
  if (fs.existsSync(ocr)) {
    // ocr-fixes.json: report file → hand fixes of OCR misreads, each checked against the scanned page.
    const fixFile = path.join(dataDir(s), 'ocr-fixes.json');
    const fixes: Record<string, OcrFix[]> = fs.existsSync(fixFile) ? JSON.parse(fs.readFileSync(fixFile, 'utf8')) : {};
    return applyOcrFixes(ocrNormalise(fs.readFileSync(ocr, 'utf8')), fixes[file] ?? []);
  }
  return execFileSync('pdftotext', ['-layout', path.join(rawDir(s), file), '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
};

/** The raw report for a year, with any committed supplement seats (supplement.json) added. */
export function loadRaw(s: StateCode, year: Year): RawElection {
  const file = path.join(dataDir(s), 'supplement.json');
  const sup: Supplement = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const mf = path.join(dataDir(s), 'missing-summaries.json');
  const missing: Record<string, Record<number, MissingSummary>> = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
  const range = electionOf(s, year).seatRange;
  const report = range ? sliceSeats(loadReport(s, year), range) : loadReport(s, year);
  return withoutSeats(applySupplement(withMissingSummaries(completeUncontested(report), missing[year] ?? {}), sup[year] ?? []), electionOf(s, year).excludeSeats ?? []);
}

/** summary-fixes.json: year → seat → sourced voters / total valid votes, for ECI summary pages with broken figures. */
function summaryFixes(s: StateCode, year: Year): SummaryFixes {
  const file = path.join(dataDir(s), 'summary-fixes.json');
  const all: Record<string, SummaryFixes> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return all[year] ?? {};
}

function loadReport(s: StateCode, year: Year): RawElection {
  const f = electionOf(s, year).files;
  const fixes = summaryFixes(s, year);
  if ('pdf' in f) {
    const t = pdfText(s, f.pdf);
    return { year, seats: parseDetailedText(t), summaries: parseSummaryText(t, fixes), parties: parsePartyListText(t), performance: parsePerformanceText(t) };
  }
  // Each report is parsed by its file type: some years publish one report only as PDF (Puducherry 2016's summary).
  const isPdf = (file: string) => /\.pdf$/i.test(file);
  const parties = isPdf(f.parties) ? parsePartyListText(pdfText(s, f.parties)) : parsePartyListRows(sheets(s, f.parties)[0]);
  return {
    year,
    seats: isPdf(f.detailed) ? parseDetailedText(pdfText(s, f.detailed)) : parseDetailedRows(sheets(s, f.detailed)[0]),
    summaries: isPdf(f.summary) ? parseSummaryText(pdfText(s, f.summary), fixes) : namedSheets(s, f.summary).map(x => parseSummaryRows(x.rows, x.name)),
    parties,
    performance: performanceByAbbr(isPdf(f.performance) ? parsePerformanceText(pdfText(s, f.performance)) : parsePerformanceRows(sheets(s, f.performance)[0]), parties),
  };
}

/** Every year's party list, each entry marked `used` when that year has a candidate with its abbreviation. */
export async function loadPartyLists(s: StateCode, years: number[] = []): Promise<(PartyListEntry & { used: boolean })[]> {
  return electionsOf(s).map(e => e.year).filter(y => !years.length || years.includes(y)).flatMap(y => {
    const raw = loadRaw(s, y);
    const used = new Set(raw.seats.flatMap(s => s.candidates.map(c => c.party.replace(/\s/g, '').toUpperCase())));
    return raw.parties.map(p => ({ ...p, used: used.has(p.abbr.replace(/\s/g, '').toUpperCase()) }));
  });
}
