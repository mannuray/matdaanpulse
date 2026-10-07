/**
 * Pre-counting check (spec §7): npm run live:check -- --election <id> --source <adapter> [--shard rest] [--config live.config.json]
 * prepare + one poll + a dry-run post; prints unmapped seats/candidates and the server's per-seat outcomes. Exit 1 if anything is unmapped or rejected.
 */
import { existsSync, readFileSync } from 'fs';
import { IngestClient } from './client';
import { ADAPTERS } from './registry';
import type { Roster } from './types';

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

/** The baseline must exist and be newer than the last candidate change (spec §5.1; decided 2026-10-07). Null = ready. */
export function baselineReady(r: Roster): string | null {
  if (!r.baseline) return 'server too old: no baseline field in the roster';
  if (!r.baseline.computed_at) return 'no baseline: compute it (admin "Compute all analysis" or the compute endpoint)';
  if (r.baseline.stale) return `baseline older than the latest candidate change (${r.baseline.computed_at}): recompute it`;
  return null;
}

async function main() {
  const election = arg('election'), source = arg('source'), shard = arg('shard') ?? 'rest';
  if (!election || !source) throw new Error('--election and --source are required');
  const file = arg('config') ?? 'live.config.json';
  const cfg = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const factory = ADAPTERS[source];
  if (!factory) throw new Error(`no adapter "${source}" (have: ${Object.keys(ADAPTERS).join(', ')})`);
  const client = new IngestClient({ baseUrl: process.env.INGEST_API_URL ?? cfg.apiBaseUrl ?? 'http://localhost:3082/api/v1', key: process.env.INGEST_KEY ?? '' });
  const adapter = factory(cfg.adapters?.[source] ?? {});
  const roster = await client.roster(election, shard);
  const notReady = baselineReady(roster);
  if (notReady) console.log(`  baseline: ${notReady}`);
  const report = await adapter.prepare(roster);
  console.log(`mapped ${report.seats_mapped}/${report.seats_total} seats`);
  for (const u of report.unmapped) console.log(`  unmapped ${u.ref}: ${u.reason}`);
  const seats = await adapter.poll();
  console.log(`poll returned ${seats.length} seat(s)`);
  let rejected = 0;
  for (let i = 0; i < seats.length; i += 100) {
    const res = await client.seats(election, { shard, source, holder: 'live-check', observed_at: new Date().toISOString(), dry_run: true, seats: seats.slice(i, i + 100) });
    rejected += res.counts.rejected;
    for (const s of res.seats.filter(x => x.outcome === 'rejected')) console.log(`  rejected ${s.const_id}: ${s.reason} ${s.detail ? JSON.stringify(s.detail) : ''}`);
  }
  const bad = rejected || report.unmapped.length || notReady;
  console.log(bad ? 'NOT READY' : 'READY');
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
