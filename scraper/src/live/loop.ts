import { IngestApiError, type IngestClient } from './client';
import type { AdapterFactory, SourceAdapter } from './types';

export interface LoopDeps { client: Pick<IngestClient, 'config' | 'lease' | 'release' | 'roster' | 'seats' | 'tally'>; adapters: Record<string, AdapterFactory>;
  adapterOpts: Record<string, Record<string, string>>; holder: string; log: (msg: string, extra?: unknown) => void; now?: () => Date }
export interface LoopState { adapter: SourceAdapter | null; source: string | null; preparedAt: number; cycle: number; leased: boolean; failures: number }
export const POST_CHUNK = 100;
export const REPREPARE_MS = 30 * 60_000;
export const TALLY_EVERY = 5;
const BACKOFF_BASE_MS = 5_000, BACKOFF_MAX_MS = 60_000;

export function newLoopState(): LoopState { return { adapter: null, source: null, preparedAt: 0, cycle: 0, leased: false, failures: 0 }; }
const jitter = (ms: number) => Math.round(ms * (0.8 + Math.random() * 0.4));

export async function runCycle(electionId: string, shard: string, st: LoopState, d: LoopDeps): Promise<number> {
  const now = d.now ?? (() => new Date());
  const tag = `[${electionId.slice(0, 8)}:${shard}]`;
  let cfg;
  try { cfg = await d.client.config(electionId, shard); }
  catch (e) { st.failures++; d.log(`${tag} config failed: ${(e as Error).message}`); return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** st.failures); }
  const idle = async (why: string) => {
    st.failures = 0;
    if (st.leased) { await d.client.release(electionId, shard, d.holder).catch(() => undefined); st.leased = false; }
    d.log(`${tag} idle: ${why}`);
    return cfg.poll_hint_ms;
  };
  if (cfg.status !== 'Live') return idle(`election is ${cfg.status}`);
  if (!cfg.source) return idle('paused');
  const factory = d.adapters[cfg.source];
  if (!factory) return idle(`no adapter for ${cfg.source}`);

  try { await d.client.lease(electionId, shard, d.holder); st.leased = true; }
  catch (e) {
    st.leased = false;
    if (e instanceof IngestApiError && e.status === 409) { st.failures = 0; d.log(`${tag} lease held by ${(e.details as any)?.holder ?? 'another job'}`, undefined); return cfg.poll_hint_ms; }
    d.log(`${tag} lease failed: ${(e as Error).message}`); return cfg.poll_hint_ms;
  }

  try {
    if (st.source !== cfg.source || !st.adapter || now().getTime() - st.preparedAt > REPREPARE_MS) {
      const fresh = factory(d.adapterOpts[cfg.source] ?? {});
      st.adapter = null; st.source = null;
      const report = await fresh.prepare(await d.client.roster(electionId, shard));
      st.adapter = fresh; st.source = cfg.source; st.preparedAt = now().getTime();
      d.log(`${tag} prepared ${cfg.source}: ${report.seats_mapped}/${report.seats_total} seats mapped`, report.unmapped.slice(0, 20));
    }
    const observed_at = now().toISOString();
    const seats = await st.adapter.poll();
    for (let i = 0; i < seats.length; i += POST_CHUNK) {
      const res = await d.client.seats(electionId, { shard, source: cfg.source, holder: d.holder, observed_at, seats: seats.slice(i, i + POST_CHUNK) });
      d.log(`${tag} posted ${Math.min(POST_CHUNK, seats.length - i)}: ${JSON.stringify(res.counts)}`, res.seats.filter(s => s.outcome === 'rejected'));
    }
    st.cycle++;
    if (st.adapter.tally && st.cycle % TALLY_EVERY === 0) {
      const parties = await st.adapter.tally();
      if (parties) {
        const r = await d.client.tally(electionId, { shard, source: cfg.source, holder: d.holder, observed_at, parties });
        if (r.mismatch.length) d.log(`${tag} tally mismatch`, r.mismatch);
      }
    }
    st.failures = 0;
    return jitter(st.adapter.intervalMs);
  } catch (e) {
    st.failures++;
    d.log(`${tag} cycle failed: ${(e as Error).message}`);
    return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** st.failures);
  }
}

export async function runForever(electionId: string, shard: string, d: LoopDeps, signal: AbortSignal): Promise<void> {
  const st = newLoopState();
  while (!signal.aborted) {
    const wait = await runCycle(electionId, shard, st, d);
    await new Promise<void>(r => { const t = setTimeout(r, wait); signal.addEventListener('abort', () => { clearTimeout(t); r(); }, { once: true }); });
  }
  if (st.leased) await d.client.release(electionId, shard, d.holder).catch(() => undefined);
}
