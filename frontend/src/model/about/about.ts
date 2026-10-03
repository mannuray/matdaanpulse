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

const ELECTIONS_IN = 'elections.in';
const ECI_ELECTIONS_IN = 'ECI / elections.in';

export const DATA_SOURCES: readonly DataSource[] = [
  { house: 'LS', state: null, year: 2024, source: 'ECI via OpenCity.in', quality: 'partial', notes: ['top5_nota', 'turnout_unreliable'] },

  { house: 'VS', state: 'Bihar', year: 2025, source: 'ECI (results.eci.gov.in)', quality: 'real', notes: ['top5_nota'] },
  { house: 'VS', state: 'Bihar', year: 2020, source: 'StatisticsTimes / ECI', quality: 'estimated', notes: ['votes_from_margin', 'two_candidates', 'reserved_wrong'] },
  { house: 'VS', state: 'Bihar', year: 2015, source: ELECTIONS_IN, quality: 'estimated', notes: ['votes_from_margin', 'two_candidates', 'reserved_wrong'] },
  { house: 'VS', state: 'Bihar', year: 2010, source: ELECTIONS_IN, quality: 'estimated', notes: ['votes_from_margin', 'two_candidates', 'reserved_wrong'] },

  { house: 'VS', state: 'West Bengal', year: 2021, source: ECI_ELECTIONS_IN, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'West Bengal', year: 2016, source: ECI_ELECTIONS_IN, quality: 'real', notes: ['two_candidates'] },
  { house: 'VS', state: 'West Bengal', year: 2011, source: ECI_ELECTIONS_IN, quality: 'real', notes: ['two_candidates'] },

  { house: 'VS', state: 'Tamil Nadu', year: 2021, source: ECI_ELECTIONS_IN, quality: 'estimated', notes: ['votes_from_margin', 'two_candidates'] },
  { house: 'VS', state: 'Tamil Nadu', year: 2016, source: ECI_ELECTIONS_IN, quality: 'real', notes: ['two_candidates', 'seats_postponed'] },
  { house: 'VS', state: 'Tamil Nadu', year: 2011, source: ECI_ELECTIONS_IN, quality: 'real', notes: ['two_candidates'] },

  { house: 'VS', state: 'Kerala', year: 2021, source: null, quality: 'estimated', notes: ['votes_from_margin', 'two_candidates', 'source_unrecorded'] },
  { house: 'VS', state: 'Kerala', year: 2016, source: null, quality: 'real', notes: ['two_candidates', 'source_unrecorded'] },
  { house: 'VS', state: 'Kerala', year: 2011, source: null, quality: 'real', notes: ['two_candidates', 'source_unrecorded'] },

  { house: 'VS', state: 'Assam', year: 2021, source: null, quality: 'estimated', notes: ['placeholder_names', 'votes_from_margin', 'reserved_wrong', 'source_unrecorded'] },
  { house: 'VS', state: 'Assam', year: 2016, source: null, quality: 'partial', notes: ['two_candidates', 'reserved_wrong', 'source_unrecorded'] },
  { house: 'VS', state: 'Assam', year: 2011, source: null, quality: 'partial', notes: ['two_candidates', 'reserved_wrong', 'source_unrecorded'] },

  { house: 'VS', state: 'Puducherry', year: 2021, source: null, quality: 'estimated', notes: ['winner_only', 'votes_from_margin', 'source_unrecorded'] },
  { house: 'VS', state: 'Puducherry', year: 2016, source: null, quality: 'real', notes: ['two_candidates', 'source_unrecorded'] },
  { house: 'VS', state: 'Puducherry', year: 2011, source: null, quality: 'real', notes: ['two_candidates', 'source_unrecorded'] },
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
