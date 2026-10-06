/**
 * OCR a scanned ECI report (no text layer, e.g. Arunachal 2014) into `<pdf>.ocr.txt` next to it, in the layout the PDF
 * parsers read (`load.ts` prefers that file to pdftotext). macOS only: pages rendered by pdftoppm (300 dpi), text from
 * the Vision framework (`ocr.swift`, compiled once). Slips are caught by the reports' own cross-checks.
 * Usage: npx ts-node src/bihar/ocr-cli.ts <STATE> <year>
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { electionOf, parseState } from './elections';
import { rawDir } from './load';
import { mergeOcr, ocrLayout } from './ocr';

const ST = parseState(process.argv[2]);
const cfg = electionOf(ST, Number(process.argv[3]));
if (!cfg.files || !('pdf' in cfg.files)) throw new Error(`${ST} ${cfg.year}: not a one-PDF report`);
const pdf = path.join(rawDir(ST), cfg.files.pdf);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
const bin = path.join(os.tmpdir(), 'matdaanpulse-ocr-2');
if (!fs.existsSync(bin)) execFileSync('swiftc', ['-O', path.join(__dirname, 'ocr.swift'), '-o', bin], { stdio: 'inherit' });
execFileSync('pdftoppm', ['-r', '300', '-png', pdf, path.join(tmp, 'p')]);
// Two passes per page: the whole page, then its number columns alone (x ≥ 0.55), merged without duplicates.
const ocr = (f: string, ...a: string[]) => execFileSync(bin, [path.join(tmp, f), ...a], { encoding: 'utf8' });
const pages = fs.readdirSync(tmp).filter(f => f.endsWith('.png')).sort().map(f => mergeOcr(ocr(f), ocr(f, '0.55')));
fs.writeFileSync(`${pdf}.ocr.txt`, ocrLayout(pages));
fs.rmSync(tmp, { recursive: true });
console.log(`${path.relative(process.cwd(), pdf)}.ocr.txt: ${pages.length} pages`);
