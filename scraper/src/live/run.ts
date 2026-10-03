/**
 * The counting-day worker (spec §7). Usage: npm run live -- --config live.config.json
 * Env: INGEST_API_URL (default http://localhost:3082/api/v1), INGEST_KEY (required), LIVE_HOLDER (default hostname).
 */
import { readFileSync } from 'fs';
import { hostname } from 'os';
import { IngestClient } from './client';
import { runForever } from './loop';
import { ADAPTERS } from './registry';

/** tasks[].tally: post the source's party-wise tally from these loops (default: only the rest shard's loop). */
interface LiveConfigFile { apiBaseUrl?: string; holder?: string; tasks: { election: string; shards?: string[]; tally?: boolean }[]; adapters?: Record<string, Record<string, string>> }

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const cfg: LiveConfigFile = JSON.parse(readFileSync(arg('config') ?? 'live.config.json', 'utf8'));
  const key = process.env.INGEST_KEY;
  if (!key) throw new Error('INGEST_KEY is required');
  const client = new IngestClient({ baseUrl: process.env.INGEST_API_URL ?? cfg.apiBaseUrl ?? 'http://localhost:3082/api/v1', key });
  const holder = process.env.LIVE_HOLDER ?? cfg.holder ?? hostname();
  const ac = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { console.log(`${sig}: releasing leases…`); ac.abort(); });
  const log = (msg: string, extra?: unknown) => console.log(`${new Date().toISOString()} ${msg}`, ...(extra && (!Array.isArray(extra) || extra.length) ? [JSON.stringify(extra)] : []));
  const loops = cfg.tasks.flatMap(t => (t.shards?.length ? t.shards : ['rest']).map(s => runForever(t.election, s, { client, adapters: ADAPTERS, adapterOpts: cfg.adapters ?? {}, holder, log, ...(t.tally !== undefined ? { tally: t.tally } : {}) }, ac.signal)));
  console.log(`worker ${holder}: ${loops.length} loop(s), adapters: ${Object.keys(ADAPTERS).join(', ') || 'none'}`);
  await Promise.all(loops);
}
main().catch(e => { console.error(e); process.exit(1); });
