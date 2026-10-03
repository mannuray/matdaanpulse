/**
 * About page content that is data, not copy: the contact address and the
 * provenance of every dataset. Keep DATA_SOURCES in step with database/seed*.sql:
 * when a seed is corrected, update its row here in the same change.
 */

export const CONTACT_EMAIL = 'mannu.ray@gmail.com';
export const ECI_RESULTS_URL = 'https://results.eci.gov.in/';

/** real: vote counts as published · partial: real votes, some fields missing or wrong · estimated: vote counts are not real. */
export type DataQuality = 'real' | 'partial' | 'estimated';

/** Each code is an i18n key `about_note_<code>`. */
export type DataNote =
  | 'all_candidates'
  | 'top5_nota'
  | 'two_candidates'
  | 'winner_only'
  | 'votes_from_margin'
  | 'placeholder_names'
  | 'turnout_unreliable'
  | 'reserved_wrong'
  | 'seats_postponed'
  | 'source_unrecorded';

export const DATA_NOTES: readonly DataNote[] = [
  'all_candidates', 'top5_nota', 'two_candidates', 'winner_only', 'votes_from_margin',
  'placeholder_names', 'turnout_unreliable', 'reserved_wrong', 'seats_postponed', 'source_unrecorded',
];

export interface DataSource {
  /** i18n key of the house: `lok_sabha` or `vidhan_sabha`. */
  house: 'LS' | 'VS';
  /** State name for VS, as shown in the state picker; null for LS. */
  state: string | null;
  year: number;
  source: string | null;
  quality: DataQuality;
  notes: DataNote[];
}

const ECI_STAT_REPORT = 'ECI statistical report';

export const DATA_SOURCES: readonly DataSource[] = [
  { house: 'LS', state: null, year: 2024, source: 'ECI via OpenCity.in', quality: 'partial', notes: ['top5_nota', 'turnout_unreliable'] },

  { house: 'VS', state: 'Bihar', year: 2025, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Bihar', year: 2020, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Bihar', year: 2015, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Bihar', year: 2010, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },

  { house: 'VS', state: 'West Bengal', year: 2026, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'West Bengal', year: 2021, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'West Bengal', year: 2016, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'West Bengal', year: 2011, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },

  { house: 'VS', state: 'Tamil Nadu', year: 2026, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Tamil Nadu', year: 2021, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Tamil Nadu', year: 2016, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates', 'seats_postponed'] },
  { house: 'VS', state: 'Tamil Nadu', year: 2011, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },

  { house: 'VS', state: 'Kerala', year: 2026, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Kerala', year: 2021, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Kerala', year: 2016, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Kerala', year: 2011, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },

  { house: 'VS', state: 'Assam', year: 2026, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Assam', year: 2021, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Assam', year: 2016, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Assam', year: 2011, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },

  { house: 'VS', state: 'Puducherry', year: 2026, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Puducherry', year: 2021, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Puducherry', year: 2016, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Puducherry', year: 2011, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
];

export interface DataSourceGroup {
  house: 'LS' | 'VS';
  state: string | null;
  rows: DataSource[];
}

/** One group per house + state, in DATA_SOURCES order (rows keep their order too). */
export function groupDataSources(sources: readonly DataSource[]): DataSourceGroup[] {
  const groups = new Map<string, DataSourceGroup>();
  for (const s of sources) {
    const key = `${s.house}:${s.state ?? ''}`;
    const g = groups.get(key) ?? { house: s.house, state: s.state, rows: [] };
    g.rows.push(s);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export interface DataMatrix {
  /** Every year that has a dataset, oldest first. */
  years: number[];
  /** One row per house + state (DATA_SOURCES order); `cells[year]` is that election's dataset, if any. */
  rows: { house: 'LS' | 'VS'; state: string | null; cells: Map<number, DataSource> }[];
  /** Number of states with a Vidhan Sabha dataset. */
  states: number;
}

/** The About page's election × year matrix. */
export function dataMatrix(sources: readonly DataSource[]): DataMatrix {
  const years = [...new Set(sources.map(s => s.year))].sort((a, b) => a - b);
  const rows = groupDataSources(sources).map(g => ({ house: g.house, state: g.state, cells: new Map(g.rows.map(r => [r.year, r])) }));
  return { years, rows, states: rows.filter(r => r.house === 'VS').length };
}

export interface CreditLike { url: string; source_url: string; author: string | null; licence: string; used_by: string | null }
export type CreditItem<C extends CreditLike = CreditLike> = { kind: 'one'; credit: C } | { kind: 'group'; author: string | null; licence: string; count: number };

/** Images sharing an author and licence collapse into one counted line when there are more than `max` of them. */
export function groupCredits<C extends CreditLike>(credits: C[], max = 3): CreditItem<C>[] {
  const key = (c: C) => `${c.author ?? ''}|${c.licence}`;
  const counts = new Map<string, number>();
  for (const c of credits) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
  const out: CreditItem<C>[] = [];
  const grouped = new Set<string>();
  for (const c of credits) {
    const k = key(c);
    if ((counts.get(k) ?? 0) <= max) out.push({ kind: 'one', credit: c });
    else if (!grouped.has(k)) { grouped.add(k); out.push({ kind: 'group', author: c.author, licence: c.licence, count: counts.get(k)! }); }
  }
  return out;
}
