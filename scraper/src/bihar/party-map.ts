import type { PartyEntry, PartyListEntry, PartyMap } from './types';
import { normName } from './names';

export const NEW_PARTY_COLOR = '#9CA3AF';
const IND: PartyEntry = { id: 'IND', name: 'Independent', abbreviation: 'IND', color: '#808080', recognition: null };
const NOTA: PartyEntry = { id: 'NOTA', name: 'None of the Above', abbreviation: 'NOTA', color: '#808080', recognition: null };
const abbrKey = (s: string) => s.replace(/\s/g, '').toUpperCase();

export function resolveParty(abbr: string, list: PartyListEntry[], map: PartyMap): PartyEntry | { unknown: string } {
  const a = abbrKey(abbr);
  if (a === 'IND') return IND;
  if (a === 'NOTA') return NOTA;
  const entry = list.find(p => abbrKey(p.abbr) === a);
  if (!entry) return { unknown: `abbreviation ${abbr} is not in this year's party list` };
  const hit = map[normName(entry.name)];
  return hit ?? { unknown: `no party-map entry for "${entry.name.replace(/\s+/g, ' ')}" (${abbr})` };
}

export function suggestEntries(lists: PartyListEntry[], db: PartyEntry[], map: PartyMap): { add: PartyMap; problems: string[] } {
  const add: PartyMap = {};
  const problems: string[] = [];
  for (const p of lists) {
    const key = normName(p.name);
    if (map[key] || add[key] || ['IND', 'NOTA'].includes(abbrKey(p.abbr))) continue;
    const name = p.name.replace(/\s+/g, ' ').trim();
    const same = db.filter(d => normName(d.name) === key);
    if (same.length > 1) { problems.push(`ambiguous: "${name}" matches ${same.map(d => d.id).join(', ')}; add the entry by hand`); continue; }
    if (same.length === 1) { add[key] = same[0]; continue; }
    const id = abbrKey(p.abbr).replace(/[^A-Z0-9]/g, '').slice(0, 20);
    const taken = db.find(d => d.id === id) ?? Object.values(add).find(d => d.id === id);
    if (taken) { problems.push(`collision: id ${id} for "${name}" already belongs to "${taken.name}"; add the entry by hand`); continue; }
    add[key] = { id, name, abbreviation: p.abbr.trim(), color: NEW_PARTY_COLOR, recognition: p.recognition };
  }
  return { add, problems };
}
