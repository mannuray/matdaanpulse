/** Print one SQL query that lists every leader whose candidacies sit on more than one person (expect no rows). */
import * as fs from 'fs';
import * as path from 'path';
import { parseState } from './elections';
import { trackOf } from './current-track';
import { loadSeeded } from './seeded';
import { pickCandidacy } from './leaders-seed';
import type { LeadersFile } from './leaders-data';
import type { Year } from './types';

const ST = parseState(process.argv[2] ?? 'BR');
const f: LeadersFile = JSON.parse(fs.readFileSync(path.join(trackOf(ST).dir, 'leaders.json'), 'utf8'));
const s = new Map((Object.keys(f.elections).map(Number) as Year[]).map(y => [y, loadSeeded(ST, y)]));
const rows = f.people.filter(p => p.candidacies.length > 1).map(p => {
  const ids = p.candidacies.map(c => {
    const y = s.get(c.year as Year)!;
    const seat = y.json.seats.find(x => y.seat(x.constNo).id === c.const_id)!;
    const best = pickCandidacy(seat.candidates, p.name)!;
    return `'${y.idOf(seat.constNo, best)}'`;
  });
  return `SELECT '${p.key}' AS leader, count(DISTINCT person_id) AS persons FROM candidates WHERE id IN (${ids.join(', ')})`;
});
// No leader with several candidacies: nothing can be split (an empty query that returns no rows).
console.log(rows.length ? `SELECT * FROM (${rows.join('\nUNION ALL ')}) t WHERE persons > 1;` : 'SELECT NULL AS leader WHERE false;');
