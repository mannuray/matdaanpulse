/**
 * OCR text (scanned ECI reports, e.g. Arunachal 2014) → the `pdftotext -layout` shape the PDF parsers read. Input per
 * page: lines "y x text" from `ocr.swift` (normalised coordinates, top-left origin). Tokens on one row (y within
 * ROW_TOLERANCE) are placed at their column (x × width), at least one space apart; pages end with a form feed.
 */
const ROW_TOLERANCE = 0.006;

export function ocrLayout(pages: string[], width = 180): string {
  return pages.map(page => {
    const tokens = page.split('\n').map(l => /^(\S+) (\S+) (.*)$/.exec(l)).filter((m): m is RegExpExecArray => !!m)
      .map(m => ({ y: Number(m[1]), x: Number(m[2]), text: m[3] })).sort((a, b) => a.y - b.y);
    const rows: { y: number; tokens: typeof tokens }[] = [];
    for (const t of tokens) {
      const row = rows[rows.length - 1];
      if (row && t.y - row.y < ROW_TOLERANCE) row.tokens.push(t); else rows.push({ y: t.y, tokens: [t] });
    }
    return rows.map(r => r.tokens.sort((a, b) => a.x - b.x).reduce((line, t) => {
      const col = Math.max(Math.round(t.x * width), line.length ? line.length + 1 : 0);
      return line.padEnd(col) + t.text;
    }, '')).join('\n') + '\n\f';
  }).join('\n');
}

/**
 * Clean OCR text before parsing: the systematic misreads, and blank numbers read as 0 (the scans leave zeros faint or
 * empty, e.g. every figure of a seat won unopposed). Only rows with no number at all are filled; a row with some
 * numbers missing is a misread, fixed by hand in `ocr-fixes.json` (and caught by the reports' cross-checks).
 */
const CYRILLIC: Record<string, string> = { 'А': 'A', 'В': 'B', 'Е': 'E', 'З': '3', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X' };

export function ocrNormalise(text: string): string {
  return text.split('\n').map(raw => {
    // Vision sometimes reads Latin capitals and 3 as Cyrillic look-alikes ("З ТОКО").
    const line = raw.replace(/[А-ЯЁ]/g, c => CYRILLIC[c] ?? c);
    let l = line.replace(/^(\s*)([IlV]+)(\.|\(A\)\.)/, (_m, sp: string, n: string, end: string) => sp + n.replace(/l/g, 'I') + end).replace(/INGLUDING/g, 'INCLUDING').replace(/TOTALVALID/g, 'TOTAL VALID').replace(/\bNOTAR\b/g, 'NOTA')
      .replace(/^(\s*Constituency\s+\d+\.)(?=\S)/, '$1 ');
    const hasNumber = /\d\s*$/.test(l);
    if (/^\s*(WINNER|MARGIN)\b/.test(l) && !hasNumber) l += '   0';
    else if (/^\s*\d+\.\s*(NOMINATION|WITHDRAWN|CONTESTED|FORFEITED|GENERAL|OVERSEAS|SERVICE|TOTAL|PROXY|POSTAL|VOTES|TENDERED|TEST|VALID)/i.test(l) && !hasNumber) l += '   0'; // a numbered summary row ("5. TOTAL")
    else if (/^\s*TURNOUT\s+TOTAL:(\s+0)*\s*$/.test(l)) l = l.replace(/(TOTAL:)[\s0]*$/, '$1') + '   0   0   0   0.00';
    else if (/^\s*\d+\s+[A-Za-z]/.test(l) && /\s(?:M|F|O|TG)\s+\d+\s|\sNOTA\s+NOTA(?:\s|$)/.test(l)) {
      // a Detailed Results candidate row: no digit left once the serial and "sex age" are removed → no votes printed
      if (!/\d/.test(l.replace(/^\s*\d+\s+/, '').replace(/\s(?:M|F|O|TG)\s+\d+\s/, ' '))) l += '   0   0   0   0.00';
      // only zeros printed → a row of zeros
      else if (/[A-Za-z]\s+0(\s+0)*\s*$/.test(l)) l = l.replace(/\s+0(\s+0)*\s*$/, '') + '   0   0   0   0.00';
      // general, total and % but a blank postal column: postal = total - general
      else if (!/\s\d+\s+\d+\s+\d+\s+\d+\.\d+\s*$/.test(l)) {
        l = l.replace(/(\d+)\s+(\d+)(\s+\d+\.\d+\s*)$/, (all, g: string, t: string, rest: string) => (Number(t) >= Number(g) ? `${g}   ${Number(t) - Number(g)}   ${t}${rest}` : all));
      }
    }
    return l;
  }).join('\n');
}

/** A hand fix of an OCR misread, checked against the scanned page (`note` says where). */
export interface OcrFix { find: string; replace: string; note: string }

export function applyOcrFixes(text: string, fixes: OcrFix[]): string {
  return fixes.reduce((t, f) => {
    const n = t.split(f.find).length - 1;
    if (n !== 1) throw new Error(`OCR fix matches ${n} times: ${f.find}`);
    return t.replace(f.find, f.replace);
  }, text);
}

/** Add a second pass's numeric tokens ("y x text" lines) that overlap no token of the first pass on the same row. */
export function mergeOcr(first: string, second: string): string {
  // A token spans about CHAR_WIDTH of the page per character; overlapping spans on one row are the same text.
  const CHAR_WIDTH = 0.0075;
  const parse = (s: string) => s.split('\n').map(l => /^(\S+) (\S+) (.*)$/.exec(l)).filter((m): m is RegExpExecArray => !!m)
    .map(m => ({ y: Number(m[1]), x: Number(m[2]), end: Number(m[2]) + m[3].length * CHAR_WIDTH, line: m[0] }));
  const have = parse(first);
  const extra = parse(second).filter(t => /^[\d.,%]+$/.test(t.line.split(' ').slice(2).join(' '))).filter(t => !have.some(h => Math.abs(h.y - t.y) < ROW_TOLERANCE && t.x < h.end + 0.005 && h.x < t.end + 0.005));
  return [...have, ...extra].map(t => t.line).join('\n');
}
