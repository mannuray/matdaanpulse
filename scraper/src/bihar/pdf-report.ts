import type { PartyListEntry, PartyPerformance, RawCandidate, RawSeat, Recognition, SeatSummary, SeatType, SummaryPick } from './types';
import { isoDate, sexOf, splitAcName } from './names';
import { recognitionOf } from './xls-report';

const SEAT_RE = /^\s*Constituency\s+(\d+)\.\s+(.+?)\s{2,}TOTAL ELECTORS\s*:\s*(\d+)/;
const TURNOUT_RE = /^\s*TURNOUT\s+TOTAL:\s+(\d+)\s+(\d+)\s+(\d+)/;
/** serial, middle (name … party [symbol]), general, postal, total, % */
const CAND_RE = /^\s*(\d+)\s+(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+\.\d+)\s*$/;
const NOISE_RE = /Election Commission of India|DETAILED RESULTS|VALID VOTES POLLED|^\s*% VOTES|CANDIDATE NAME|^\s*POLLED\s*$|Page \d+ of \d+/i;

interface Fragment { col: number; text: string }
/** Split a line into fragments separated by 2+ spaces, with their start columns. */
function fragments(line: string): Fragment[] {
  const out: Fragment[] = [];
  const re = /\S+(?: \S+)*/g;
  for (let m = re.exec(line); m; m = re.exec(line)) out.push({ col: m.index, text: m[0] });
  return out;
}

interface Cols { sex: number; party: number; partyEnd: number; symbol: number }

function readCandidate(line: string, m: RegExpExecArray): { cand: RawCandidate; cols: Cols | null } {
  const midStart = line.indexOf(m[2], line.indexOf(m[1]) + m[1].length);
  const frags = fragments(m[2]).map(f => ({ col: f.col + midStart, text: f.text }));
  const general = Number(m[3]), postal = Number(m[4]), total = Number(m[5]);
  if (frags.length >= 3 && frags[frags.length - 2].text === 'NOTA') {
    return { cand: { serial: Number(m[1]), name: 'NOTA', sex: null, age: null, party: 'NOTA', general, postal, total }, cols: null };
  }
  // name … sex age category party [symbol]: the sex fragment may be glued to the age ("M 37" when spaced by one).
  const flat = frags.flatMap(f => (/^(M|F|O|TG)\s+\d+$/.test(f.text) ? f.text.split(/\s+/).map((t, i) => ({ col: f.col + (i ? f.text.indexOf(t, 1) : 0), text: t })) : [f]));
  const si = flat.findIndex((f, i) => i > 0 && /^(M|F|O|TG)$/.test(f.text) && /^\d+$/.test(flat[i + 1]?.text ?? '') && /^(GEN|SC|ST)$/.test(flat[i + 2]?.text ?? ''));
  if (si < 1 || !flat[si + 3]) throw new Error(`Detailed Results: cannot read candidate line: ${line.trim()}`);
  let party = flat[si + 3];
  let symbol = flat[si + 4];
  const sp = party.text.indexOf(' ');
  if (sp > 0) { // a long abbreviation one space from its symbol ("SASAPT Television"): abbreviations have no spaces
    symbol = { col: party.col + sp + 1, text: party.text.slice(sp + 1) };
    party = { col: party.col, text: party.text.slice(0, sp) };
  }
  return {
    cand: { serial: Number(m[1]), name: flat.slice(0, si).map(f => f.text).join(' '), sex: sexOf(flat[si].text), age: Number(flat[si + 1].text),
      party: party.text, general, postal, total },
    cols: { sex: flat[si].col, party: party.col, partyEnd: party.col + party.text.length, symbol: symbol ? symbol.col : Number.POSITIVE_INFINITY },
  };
}

export function parseDetailedText(text: string): RawSeat[] {
  const seats: RawSeat[] = [];
  let cur: RawSeat | null = null;
  let last: { cand: RawCandidate; cols: Cols } | null = null;
  for (const line of text.split('\n')) {
    const s = SEAT_RE.exec(line);
    if (s) {
      if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row before seat ${s[1]}`);
      const ac = splitAcName(s[2]);
      cur = { constNo: Number(s[1]), acName: ac.name, type: ac.type, electors: Number(s[3]), candidates: [], nota: null, totalVotes: 0 };
      last = null;
      continue;
    }
    if (!cur) continue;
    const t = TURNOUT_RE.exec(line);
    if (t) { cur.totalVotes = Number(t[3]); seats.push(cur); cur = null; last = null; continue; }
    if (!line.trim() || NOISE_RE.test(line)) continue;
    const c = CAND_RE.exec(line);
    if (c) {
      const { cand, cols } = readCandidate(line, c);
      if (cand.party === 'NOTA') { cur.nota = cand.total; last = null; continue; }
      cur.candidates.push(cand);
      last = cols ? { cand, cols } : null;
      continue;
    }
    if (!last) throw new Error(`Detailed Results: unexpected line in seat ${cur.constNo}: ${line.trim()}`);
    for (const f of fragments(line)) {
      if (f.col < last.cols.sex - 1) last.cand.name += ` ${f.text}`;
      else if (f.col >= last.cols.party - 3 && f.col < Math.min(last.cols.symbol, last.cols.partyEnd + 3)) last.cand.party += f.text;
    }
  }
  if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row`);
  for (const seat of seats) for (const c of seat.candidates) c.name = c.name.replace(/\s+/g, ' ').trim();
  return seats;
}

const lastNumber = (line: string): number => {
  const m = /(\d+(?:\.\d+)?)\s*$/.exec(line);
  if (!m) throw new Error(`no trailing number: ${line.trim()}`);
  return Number(m[1]);
};

export function parseSummaryText(text: string): SeatSummary[] {
  const lines = text.split('\n');
  const out: SeatSummary[] = [];
  let block: string[] | null = null;
  const flush = () => { if (block) out.push(readSummaryBlock(block)); };
  for (const line of lines) {
    if (/^\s*CONSTITUENCY\s*:-?\s*\d+\s*-/.test(line)) { flush(); block = [line]; continue; }
    if (block) block.push(line);
  }
  flush();
  return out;
}

function readSummaryBlock(lines: string[]): SeatSummary {
  const head = /^\s*CONSTITUENCY\s*:-?\s*(\d+)\s*-\s*(.+?)\s*$/.exec(lines[0])!;
  const ac = splitAcName(head[2]);
  let section = '';
  const f: Record<string, number> = {};
  let pollDate = '';
  const picks: Record<string, SummaryPick> = {};
  let margin: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    const sec = /^\s*(I|II|III|III\(A\)|IV|V|VI|VII)\.\s*(\S.*)?$/.exec(l);
    if (sec) section = `${sec[1]}. ${(sec[2] ?? '').trim()}`.toUpperCase();
    if (/4\.\s*CONTESTED/.test(l)) f.contested = lastNumber(l);
    if (section.startsWith('II.') && /\d\.\s*TOTAL\b/.test(l)) f.electors = lastNumber(l);
    if (section.startsWith('III. VOTERS') && /\d\.\s*TOTAL\b/.test(l)) f.voters = lastNumber(l);
    if (section.startsWith('IV.') && /TOTAL ?VALID VOTES POLLED\s+\d+\s*$/.test(l)) f.totalValid = lastNumber(l);
    if (section.startsWith('IV.') && /VOTES POLLED FOR 'NOTA'\s*\(INCLUDING POSTAL\)/.test(l)) f.nota = lastNumber(l);
    if (section.startsWith('VI.') && /^\s*POLLING\s+COUNTING/.test(l)) {
      const next = lines.slice(i + 1).find(x => x.trim()) ?? '';
      const d = /(\d{1,2}-[A-Za-z]{3}-\d{4})/.exec(next);
      if (d) pollDate = isoDate(d[1]);
    }
    const p = /^(WINNER|RUNNER-UP)\s+(\S+)\s+(.+?)\s+(\d+)\s*$/.exec(l);
    if (p) picks[p[1]] = { party: p[2], name: p[3].trim(), votes: Number(p[4]) };
    const mg = /^MARGIN\s+(\d+)/.exec(l);
    if (mg) margin = Number(mg[1]);
  }
  const label = `${head[1]}-${head[2]}`;
  for (const k of ['contested', 'electors', 'voters', 'totalValid']) if (f[k] === undefined) throw new Error(`Summary ${label}: ${k} not found`);
  if (!pollDate || !picks.WINNER || !picks['RUNNER-UP'] || margin === null) throw new Error(`Summary ${label}: dates/result not found`);
  return { constNo: Number(head[1]), name: ac.name, type: (ac.type ?? 'GEN') as SeatType, electors: f.electors, voters: f.voters, contested: f.contested,
    totalValid: f.totalValid, nota: f.nota ?? null, pollDate, winner: picks.WINNER, runnerUp: picks['RUNNER-UP'], margin };
}

export function parsePartyListText(text: string): PartyListEntry[] {
  const out: PartyListEntry[] = [];
  let inList = false;
  let rec: Recognition | null = null;
  let nameCol = -1;
  for (const line of text.split('\n')) {
    if (/PARTY TYPE\s+ABBREVIATION\s+PARTY/.test(line)) { inList = true; continue; }
    if (!inList) continue;
    if (/OTHER ABBREVIATIONS|HIGHLIGHTS|LIST OF SUCCESSFUL|PERFORMANCE OF POLITICAL/i.test(line)) break;
    const sec = recognitionOf(line.trim());
    if (sec) { rec = sec; continue; }
    const m = /^\s*(\d+)\s*\.\s+(\S+)\s{2,}(.+?)\s*$/.exec(line);
    if (m && rec) { nameCol = line.indexOf(m[3], line.indexOf(m[2]) + m[2].length); out.push({ abbr: m[2], name: m[3], recognition: rec }); continue; }
    const cont = /^(\s*)(\S.*?)\s*$/.exec(line);
    if (cont && out.length && nameCol >= 0 && Math.abs(cont[1].length - nameCol) <= 2) out[out.length - 1].name += ` ${cont[2]}`;
  }
  if (!out.length) throw new Error('Party list: no rows');
  return out;
}

export function parsePerformanceText(text: string): PartyPerformance[] {
  const out: PartyPerformance[] = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    if (/^\s*PERFORMANCE OF POLITICAL PARTIES\s*$/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^\s*[A-Z][A-Z ]+SUMMARY\s*$/.test(line) || /LIST OF SUCCESSFUL|WOMEN CANDIDATES/i.test(line)) break;
    const m = /^\s*(\d+)\s*\.\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(line);
    if (m && m[2].toUpperCase() !== 'NOTA') out.push({ abbr: m[2], contested: Number(m[3]), won: Number(m[4]), votes: Number(m[6]) });
  }
  if (!out.length) throw new Error('Performance: no rows');
  return out;
}
