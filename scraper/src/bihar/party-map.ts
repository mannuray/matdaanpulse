import type { PartyEntry, PartyListEntry, PartyMap } from './types';
import { normName } from './names';

export const NEW_PARTY_COLOR = '#9CA3AF';
const IND: PartyEntry = { id: 'IND', name: 'Independent', abbreviation: 'IND', color: '#808080', recognition: null };
const NOTA: PartyEntry = { id: 'NOTA', name: 'None of the Above', abbreviation: 'NOTA', color: '#808080', recognition: null };
const abbrKey = (s: string) => s.replace(/\s/g, '').toUpperCase();
/** party-map.json key: the normalised full name without spaces ("Lok Jan Shakti Party" = "Lok Janshakti Party"). */
export const partyKey = (name: string) => normName(name).replace(/\s/g, '');

export function resolveParty(abbr: string, list: PartyListEntry[], map: PartyMap): PartyEntry | { unknown: string } {
  const a = abbrKey(abbr);
  if (a === 'IND') return IND;
  if (a === 'NOTA') return NOTA;
  const entry = list.find(p => abbrKey(p.abbr) === a);
  if (!entry) return { unknown: `abbreviation ${abbr} is not in this year's party list` };
  const hit = map[partyKey(entry.name)];
  return hit ?? { unknown: `no party-map entry for "${entry.name.replace(/\s+/g, ' ')}" (${abbr})` };
}

/** A DB party with how many candidates use it (to choose between duplicate ids). */
export type DbParty = PartyEntry & { candidates?: number };

/** `suffix` (a state code) makes a colliding new id unique: JJP → JJP_WB. */
export function suggestEntries(lists: PartyListEntry[], db: DbParty[], map: PartyMap, suffix = 'BR'): { add: PartyMap; problems: string[]; notes: string[]; aliases: Record<string, string> } {
  const add: PartyMap = {};
  const aliases: Record<string, string> = {};
  const problems = new Set<string>();
  const notes = new Set<string>();
  const strip = ({ candidates: _c, ...p }: DbParty): PartyEntry => p;
  for (const p of lists) {
    const key = partyKey(p.name);
    if (map[key] || add[key] || ['IND', 'NOTA'].includes(abbrKey(p.abbr))) continue;
    const name = p.name.replace(/\s+/g, ' ').trim();
    const same = db.filter(d => partyKey(d.name) === key).sort((a, b) => (b.candidates ?? 0) - (a.candidates ?? 0));
    for (const d of same.slice(1)) aliases[d.id] = same[0].id;
    if (same.length > 1) notes.add(`duplicate ids in DB for "${name}": ${same.map(d => `${d.id} (${d.candidates ?? 0})`).join(', ')}; using ${same[0].id}`);
    if (same.length) { add[key] = strip(same[0]); continue; }
    const base = abbrKey(p.abbr).replace(/[^A-Z0-9]/g, '').slice(0, 17);
    const taken = (id: string) => db.some(d => d.id === id) || Object.values(add).some(d => d.id === id);
    const alt = `${base}_${suffix}`;
    const id = !taken(base) ? base : !taken(alt) ? alt : null;
    if (!id) { problems.add(`collision: ids ${base} and ${alt} for "${name}" are taken; add the entry by hand`); continue; }
    add[key] = { id, name, abbreviation: p.abbr.trim(), color: NEW_PARTY_COLOR, recognition: p.recognition };
  }
  return { add, problems: [...problems], notes: [...notes], aliases };
}

/**
 * Per-state overrides (scraper/data/<slug>/party-overrides.json: full-name key → existing party id). Used when one
 * ECI name means a different party in this state than the shared map says (Kerala's "Muslim League Kerala State
 * Committee" is IUML; Bihar's 2010 rows keep MUL_BR). The shared map is not changed.
 */
export function applyOverrides(map: PartyMap, overrides: Record<string, string>): PartyMap {
  const out: PartyMap = { ...map };
  for (const [key, id] of Object.entries(overrides)) {
    const target = Object.values(map).find(p => p.id === id);
    if (!target) throw new Error(`party override ${key} → ${id}: no party with id ${id} in the party map`);
    out[key] = target;
  }
  return out;
}
