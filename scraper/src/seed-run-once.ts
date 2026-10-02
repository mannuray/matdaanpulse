/**
 * Run-once wrapper for generated seed files (seed_runs, migration 018).
 *
 * setup.sh re-runs every seed on every deploy. A seed whose effect admins may later change (person links,
 * person regions) must not be re-applied, so its body sits under a psql `\if` that is true only when
 * seed_runs has no row for it and none of `alreadyApplied` holds. The marker is written either way, so a
 * database where an older setup.sh applied the seed before seed_runs existed is marked on its first run.
 * Needs psql 10+ (`\if`, `\gset`), as setup.sh uses.
 */

/** `WITH ids(id) AS (...)`: the uuids as a one-column CTE, for `alreadyApplied` conditions. */
export function idsCte(ids: string[]): string {
  return `WITH ids(id) AS (SELECT unnest('{${ids.join(',')}}'::uuid[]))`;
}

/** No curated person id is a merged-away duplicate or a merge keeper (the person_merges log). */
export const NOT_IN_MERGE_LOG =
  'NOT EXISTS (SELECT 1 FROM person_merges m JOIN ids ON ids.id::text = m.duplicate->>\'id\' OR ids.id = m.keeper_ref)';

export interface RunOnceSeed {
  /** The seed_runs key: the file name without `.sql`. */
  name: string;
  /** Comment lines (without `-- `) explaining why this seed is run-once. */
  comment: string[];
  /** Optional CTE (see idsCte) the conditions read. */
  cte?: string;
  /** Extra conditions that must all hold for the body to run (none of them true once the seed was applied). */
  conditions?: string[];
  /** Statements that always run (idempotent), before the guard. */
  always?: string[];
  /** The seed's statements, run once. */
  body: string[];
}

/** The lines from BEGIN; to COMMIT; for a run-once seed. */
export function runOnce(s: RunOnceSeed): string[] {
  const conditions = [`NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = '${s.name}')`, ...(s.conditions ?? [])];
  return [
    'BEGIN;',
    '',
    ...(s.always?.length ? [...s.always, ''] : []),
    ...s.comment.map((l) => `-- ${l}`),
    ...(s.cte ? [s.cte] : []),
    `SELECT ${conditions.join('\n   AND ')}`,
    '   AS seed_apply \\gset',
    '\\if :seed_apply',
    '',
    ...s.body,
    '',
    '\\endif',
    `INSERT INTO seed_runs (name) VALUES ('${s.name}') ON CONFLICT (name) DO NOTHING;`,
    '',
    'COMMIT;',
    '',
  ];
}
