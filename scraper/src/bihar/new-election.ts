/** An election with no old seed (2026): the elections row, constituencies and manifest come from the registry and the report. */
import { STATES, type ElectionConfig } from './elections';
import type { ExistingSeed } from './existing-seed';
import type { ElectionJson } from './types';
import { q } from './sql';

/** The legacy constituency id convention: `<prefix><no>_<NAME>`, name upper-cased, punctuation dropped, words joined by _. */
export function constIdFor(prefix: string, constNo: number, name: string): string {
  return `${prefix}${constNo}_${name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')}`;
}

export function newElectionSeed(cfg: ElectionConfig, json: ElectionJson, manifestJson: string | null): ExistingSeed {
  const n = cfg.newElection;
  if (!n) throw new Error(`${cfg.state} ${cfg.year} is not a new election`);
  const st = STATES[cfg.state];
  return {
    electionSql: `INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date, delimitation) VALUES (${q(cfg.electionId)}, ${q(n.name)}, 'VS', ${st.stateId}, ${cfg.year}, 'Finalized', ${q(n.resultDate)}, ${q(n.delimitation)}) ON CONFLICT (id) DO NOTHING;`,
    constituencies: json.seats.map(s => {
      if (!s.name) throw new Error(`seat ${s.constNo} has no name`);
      return { id: constIdFor(cfg.constPrefix, s.constNo, s.name), constNo: s.constNo, name: s.name };
    }),
    candidates: [],
    manifestJson,
  };
}
