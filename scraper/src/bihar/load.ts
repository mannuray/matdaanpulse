import * as path from 'path';
import { execFileSync } from 'child_process';
import * as XLSX from 'xlsx';
import type { PartyListEntry, RawElection, Year } from './types';
import { YEARS } from './years';
import { parseDetailedRows, parsePartyListRows, parsePerformanceRows, parseSummaryRows, type Row } from './xls-report';
import { parseDetailedText, parsePartyListText, parsePerformanceText, parseSummaryText } from './pdf-report';
import * as fs from 'fs';
import { applySupplement, type Supplement } from './supplement';

export const DATA_DIR = path.resolve(__dirname, '../../data/bihar');
export const RAW_DIR = path.resolve(__dirname, '../../data/raw/bihar');

const sheets = (file: string): Row[][] => {
  const wb = XLSX.readFile(path.join(RAW_DIR, file));
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_json<Row>(wb.Sheets[n], { header: 1, defval: null }));
};
const pdfText = (file: string): string =>
  execFileSync('pdftotext', ['-layout', path.join(RAW_DIR, file), '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** The raw report for a year, with any committed supplement seats (supplement.json) added. */
export function loadRaw(year: Year): RawElection {
  const file = path.join(DATA_DIR, 'supplement.json');
  const sup: Supplement = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return applySupplement(loadReport(year), sup[year] ?? []);
}

function loadReport(year: Year): RawElection {
  const f = YEARS[year].files;
  if ('pdf' in f) {
    const t = pdfText(f.pdf);
    return { year, seats: parseDetailedText(t), summaries: parseSummaryText(t), parties: parsePartyListText(t), performance: parsePerformanceText(t) };
  }
  return {
    year,
    seats: parseDetailedRows(sheets(f.detailed)[0]),
    summaries: sheets(f.summary).map(parseSummaryRows),
    parties: parsePartyListRows(sheets(f.parties)[0]),
    performance: parsePerformanceRows(sheets(f.performance)[0]),
  };
}

/** Every year's party list, each entry marked `used` when that year has a candidate with its abbreviation. */
export async function loadPartyLists(): Promise<(PartyListEntry & { used: boolean })[]> {
  return (Object.keys(YEARS).map(Number) as Year[]).flatMap(y => {
    const raw = loadRaw(y);
    const used = new Set(raw.seats.flatMap(s => s.candidates.map(c => c.party.replace(/\s/g, '').toUpperCase())));
    return raw.parties.map(p => ({ ...p, used: used.has(p.abbr.replace(/\s/g, '').toUpperCase()) }));
  });
}
