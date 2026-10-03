import type { IngestConfig, PartyTally, Roster, SeatState, SeatsResponse } from './types';

export class IngestApiError extends Error {
  constructor(message: string, public status: number, public code: string | null, public details: unknown) { super(message); }
}

/** Typed client for the ingest API (spec §4). Retries network errors and 5xx with backoff; 4xx are thrown at once. */
export class IngestClient {
  private readonly f: typeof fetch;
  private readonly retries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly opts: { baseUrl: string; key: string; fetch?: typeof fetch; retries?: number; sleep?: (ms: number) => Promise<void> }) {
    this.f = opts.fetch ?? fetch;
    this.retries = opts.retries ?? 3;
    this.sleep = opts.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  }

  roster(electionId: string, shard?: string): Promise<Roster> { return this.call('GET', `/ingest/elections/${electionId}/roster${shard ? `?shard=${encodeURIComponent(shard)}` : ''}`); }
  config(electionId: string, shard: string): Promise<IngestConfig> { return this.call('GET', `/ingest/elections/${electionId}/config?shard=${encodeURIComponent(shard)}`); }
  lease(electionId: string, shard: string, holder: string): Promise<{ expires_at: string }> { return this.call('POST', `/ingest/elections/${electionId}/lease`, { shard, holder }); }
  async release(electionId: string, shard: string, holder: string): Promise<void> {
    await this.call('DELETE', `/ingest/elections/${electionId}/lease?shard=${encodeURIComponent(shard)}&holder=${encodeURIComponent(holder)}`);
  }
  seats(electionId: string, body: { shard: string; source: string; holder: string; observed_at: string; dry_run?: boolean; seats: SeatState[] }): Promise<SeatsResponse> {
    return this.call('POST', `/ingest/elections/${electionId}/seats`, body);
  }
  tally(electionId: string, body: { shard: string; source: string; holder: string; observed_at: string; parties: PartyTally[] }): Promise<{ mismatch: unknown[] }> {
    return this.call('POST', `/ingest/elections/${electionId}/tally`, body);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await this.sleep(Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 250);
      let res: Response;
      try {
        res = await this.f(`${this.opts.baseUrl}${path}`, {
          method, headers: { Authorization: `Bearer ${this.opts.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (e) { last = e; continue; }
      const json: any = await res.json().catch(() => null);
      if (res.ok) return json?.data as T;
      const e = new IngestApiError(json?.error?.message ?? `HTTP ${res.status}`, res.status, json?.error?.code ?? null, json?.error?.details ?? null);
      if (res.status < 500) throw e;
      last = e;
    }
    throw last instanceof IngestApiError ? last : new IngestApiError(String((last as Error)?.message ?? last), 0, null, null);
  }
}
