/** Print one SQL query that lists every leader whose candidacies sit on more than one person (expect no rows). */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { loadSeeded } from './seeded';
import { similarity } from './names';
import type { LeadersFile } from './leaders-data';
import type { Year } from './types';

const f: LeadersFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaders.json'), 'utf8'));
const s = new Map(([2010, 2015, 2020, 2025] as Year[]).map(y => [y, loadSeeded(y)]));
const rows = f.people.filter(p => p.candidacies.length > 1).map(p => {
  const ids = p.candidacies.map(c => {
    const y = s.get(c.year as Year)!;
    const seat = y.json.seats.find(x => y.seat(x.constNo).id === c.const_id)!;
    const best = seat.candidates.filter(x => x.partyId !== 'NOTA').sort((a, b) => similarity(b.name, p.name) - similarity(a.name, p.name))[0];
    return `'${y.idOf(seat.constNo, best)}'`;
  });
  return `SELECT '${p.key}' AS leader, count(DISTINCT person_id) AS persons FROM candidates WHERE id IN (${ids.join(', ')})`;
});
console.log(`SELECT * FROM (${rows.join('\nUNION ALL ')}) t WHERE persons > 1;`);
