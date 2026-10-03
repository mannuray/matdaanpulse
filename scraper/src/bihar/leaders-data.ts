/** scraper/data/bihar/leaders.json: Tier A leaders, curated once with sources and reviewed by the user (spec §7). */

export interface LeaderPerson {
  /** kebab-case, unique, e.g. "nitish-kumar". */
  key: string;
  /** Display name for manifests, e.g. "Nitish Kumar". */
  name: string;
  wikidata: string | null;
  /** Bihar VS candidacies that are this person; empty for leaders without a seat (e.g. Legislative Council members). */
  candidacies: { year: number; const_id: string }[];
}
export interface LeaderRole { key: string; role: string; party_id: string }
/** An election year with curated leaders (Bihar 2010-2025; the 2026 states). */
export type LeaderYear = string;
export interface LeadersFile {
  people: LeaderPerson[];
  elections: Record<LeaderYear, { leaders: LeaderRole[]; cabinet: LeaderRole[]; sources: string[] }>;
}

export const MAX_LEADERS = 60;

/** Consistency errors; `seats` maps a year to the const_ids of that year's seed. */
export function validateLeaders(f: LeadersFile, seats: Record<string, Set<string>>): string[] {
  const errs: string[] = [];
  const keys = new Set<string>();
  for (const p of f.people) {
    if (keys.has(p.key)) errs.push(`duplicate key "${p.key}"`);
    keys.add(p.key);
    if (!p.wikidata && !p.candidacies.length) errs.push(`${p.key}: neither wikidata nor candidacies`);
    for (const c of p.candidacies) {
      if (!seats[String(c.year)]?.has(c.const_id)) errs.push(`${p.key}: ${c.year} seat ${c.const_id} is not in the year seed`);
    }
  }
  if (f.people.length > MAX_LEADERS) errs.push(`${f.people.length} people, at most ${MAX_LEADERS}`);
  for (const [year, e] of Object.entries(f.elections)) {
    if (!e.sources.length) errs.push(`${year}: no sources`);
    for (const r of [...e.leaders, ...e.cabinet]) if (!keys.has(r.key)) errs.push(`${year}: unknown person "${r.key}"`);
  }
  return errs;
}
