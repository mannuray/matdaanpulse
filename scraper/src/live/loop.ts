import { IngestApiError, type IngestClient } from './client';
import type { AdapterFactory, SourceAdapter } from './types';

export interface LoopDeps { client: Pick<IngestClient, 'config' | 'lease' | 'release' | 'roster' | 'seats' | 'tally'>; adapters: Record<string, AdapterFactory>;
  adapterOpts: Record<string, Record<string, string>>; holder: string; log: (msg: string, extra?: unknown) => void; now?: () => Date;
  /** Post the source's party-wise tally from this loop (default: only the rest shard's loop, as the tally covers the whole election). */
  tally?: boolean }
export interface LoopState { adapter: SourceAdapter | null; source: string | null; preparedAt: number; cycle: number; leased: boolean; failures: number }
export const POST_CHUNK = 100;
export const REPREPARE_MS = 30 * 60_000;
export const TALLY_EVERY = 5;
/** The server's 409 names only when the other job's lease ends, never its holder. */
const heldUntil = (e: IngestApiError) => { const at = (e.details as { expires_at?: string } | null)?.expires_at; return at ? ` until ${at}` : ''; };

/** Lease renewal while a cycle runs (the server's lease TTL is 90 s). */
export const HEARTBEAT_MS = 30_000;
export const SLOW_CYCLE_MS = 60_000;
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
    if (e instanceof IngestApiError && e.status === 409) { st.failures = 0; d.log(`${tag} lease held by another job${heldUntil(e)}`, undefined); return cfg.poll_hint_ms; }
    d.log(`${tag} lease failed: ${(e as Error).message}`); return cfg.poll_hint_ms;
  }

  // Keep the lease while the cycle runs (a large shard's poll can outlast the TTL); a lost lease ends the cycle at the next chunk.
  let lostTo: string | null = null;
  const lost = (e: unknown) => { if (e instanceof IngestApiError && e.status === 409) { lostTo = `another job${e.details && (e.details as any).expires_at ? ` (held until ${(e.details as any).expires_at})` : ''}`; return true; } return false; };
  const heartbeat = setInterval(() => {
    d.client.lease(electionId, shard, d.holder).catch(e => { if (!lost(e)) d.log(`${tag} lease renewal failed: ${(e as Error).message}`); });
  }, HEARTBEAT_MS);
  const started = now().getTime();
  try {
    if (st.source !== cfg.source || !st.adapter || now().getTime() - st.preparedAt > REPREPARE_MS) {
      const fresh = factory(d.adapterOpts[cfg.source] ?? {});
      st.adapter = null; st.source = null;
      const report = await fresh.prepare(await d.client.roster(electionId, shard));
      st.adapter = fresh; st.source = cfg.source; st.preparedAt = now().getTime();
      d.log(`${tag} prepared ${cfg.source}: ${report.seats_mapped}/${report.seats_total} seats mapped`, report.unmapped.slice(0, 20));
    }
    const adapter = st.adapter;
    const observed_at = now().toISOString();
    const seats = await adapter.poll();
    for (let i = 0; i < seats.length; i += POST_CHUNK) {
      // Re-claim (renew) before every chunk: a 409 means another job took the shard, so stop cleanly instead of failing every chunk.
      if (!lostTo) await d.client.lease(electionId, shard, d.holder).catch(e => { if (!lost(e)) throw e; });
      if (lostTo) {
        st.leased = false; st.failures = 0;
        d.log(`${tag} lease lost to ${lostTo}; ending the cycle (${i}/${seats.length} seats posted)`);
        return cfg.poll_hint_ms;
      }
      const chunk = seats.slice(i, i + POST_CHUNK);
      const res = await d.client.seats(electionId, { shard, source: cfg.source, holder: d.holder, observed_at, seats: chunk });
      d.log(`${tag} posted ${chunk.length}: ${JSON.stringify(res.counts)}`, res.seats.filter(s => s.outcome === 'rejected'));
      // Only what the server took (applied / unchanged / stale) is settled; held and rejected seats are sent again next poll.
      const notTaken = new Set(res.seats.filter(s => s.outcome === 'held' || s.outcome === 'rejected').map(s => s.const_id));
      adapter.commit?.(chunk.map(s => s.const_id).filter(id => !notTaken.has(id)));
    }
    st.cycle++;
    if ((d.tally ?? shard === 'rest') && adapter.tally && st.cycle % TALLY_EVERY === 0) {
      const parties = await adapter.tally();
      if (parties) {
        const r = await d.client.tally(electionId, { shard, source: cfg.source, holder: d.holder, observed_at, parties });
        if (r.mismatch.length) d.log(`${tag} tally mismatch`, r.mismatch);
      }
    }
    st.failures = 0;
    const took = now().getTime() - started;
    d.log(`${took > SLOW_CYCLE_MS ? 'WARN slow cycle: ' : ''}${tag} cycle ${st.cycle}: ${seats.length} seat(s) in ${(took / 1000).toFixed(1)}s`);
    return jitter(adapter.intervalMs);
  } catch (e) {
    st.failures++;
    d.log(`${tag} cycle failed: ${(e as Error).message}`);
    return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** st.failures);
  } finally {
    clearInterval(heartbeat);
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
