import { parseCandidateDetailPage, parseConstituencyListPage, type ConstituencySummary } from '../../adapters/eci-vs-adapter';
import { mapCandidates, seatStateFrom } from './eci-mapping';
import type { MappingReport, PartyTally, Roster, SeatState, SourceAdapter } from '../types';
import { parsePartywisePage } from '../../adapters/eci-vs-adapter';
import { mapParty } from './eci-mapping';

type FetchText = (url: string, ifModifiedSince?: string) => Promise<{ status: number; text: string; lastModified: string | null }>;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_PAGES = 60;
const RECHECK_DECLARED_MS = 10 * 60_000;

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const makeDefaultFetch = (timeoutMs: number): FetchText => async (url, ims) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(ims ? { 'If-Modified-Since': ims } : {}) }, signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, text: res.status === 200 ? await res.text() : '', lastModified: res.headers.get('last-modified') };
};

/** ECI results site ("ResultAcGen…") — spec §7, review §4. Owns fetching, caching and mapping; returns complete seats only. */
export class EciWebAdapter implements SourceAdapter {
  readonly id: string;
  readonly intervalMs: number;
  private readonly fetchText: FetchText;
  private roster: Roster | null = null;
  private pages = new Map<number, { lastModified: string | null; rows: ConstituencySummary[] }>();
  private signature = new Map<number, string>();
  private declaredAt = new Map<number, number>();
  private rechecked = new Set<number>();
  /** Bookkeeping from the latest poll() by const_no; promoted per seat by commit(constIds) once delivered, discarded by the next poll(). */
  private pending = { signature: new Map<number, string>(), declaredAt: new Map<number, number>(), rechecked: new Set<number>() };

  constructor(private readonly opts: { id: string; baseUrl: string; stateCode: string; intervalMs?: number; concurrency?: number; partyAliases?: Record<string, string>; fetchText?: FetchText; fetchTimeoutMs?: number }) {
    this.id = opts.id;
    this.intervalMs = opts.intervalMs ?? 45_000;
    this.fetchText = opts.fetchText ?? makeDefaultFetch(opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
  }

  async prepare(roster: Roster): Promise<MappingReport> {
    this.roster = roster;
    this.signature.clear();
    const unmapped: MappingReport['unmapped'] = [];
    for (const p of new Set(roster.seats.flatMap(s => s.candidates.map(c => c.party_id)).filter(Boolean) as string[])) {
      if (!roster.parties.some(x => x.id === p)) unmapped.push({ ref: `party ${p}`, reason: 'not in roster parties' });
    }
    return { seats_total: roster.seats.length, seats_mapped: roster.seats.filter(s => s.candidates.length > 0).length, unmapped };
  }

  commit(constIds: string[]): void {
    const noOf = new Map((this.roster?.seats ?? []).map(s => [s.const_id, s.const_no]));
    for (const id of constIds) {
      const k = noOf.get(id);
      if (k === undefined) continue;
      const sig = this.pending.signature.get(k);
      if (sig !== undefined) { this.signature.set(k, sig); this.pending.signature.delete(k); }
      const at = this.pending.declaredAt.get(k);
      if (at !== undefined) { this.declaredAt.set(k, at); this.pending.declaredAt.delete(k); }
      if (this.pending.rechecked.delete(k)) this.rechecked.add(k);
    }
  }

  async poll(): Promise<SeatState[]> {
    if (!this.roster) throw new Error('prepare() first');
    const pending = this.pending = { signature: new Map<number, string>(), declaredAt: new Map<number, number>(), rechecked: new Set<number>() };
    const rows = await this.listRows();
    const byNo = new Map(this.roster.seats.map(s => [s.const_no, s]));
    const now = Date.now();
    const due = rows.filter(r => {
      if (!byNo.has(r.constNo)) return false;
      const sig = `${r.winnerName}|${r.winnerParty}|${r.margin}|${r.rounds}|${r.status}`;
      const changed = this.signature.get(r.constNo) !== sig;
      const declaredRecheck = this.declaredAt.has(r.constNo) && !this.rechecked.has(r.constNo) && now - this.declaredAt.get(r.constNo)! > RECHECK_DECLARED_MS;
      return changed || declaredRecheck;
    });
    const out: SeatState[] = [];
    await pool(due, this.opts.concurrency ?? 3, async r => {
      const seat = byNo.get(r.constNo)!;
      try {
        const sig = `${r.winnerName}|${r.winnerParty}|${r.margin}|${r.rounds}|${r.status}`;
        const { state, round } = seatStateFrom(r.rounds, r.status);
        if (state === 'not_started') { this.signature.set(r.constNo, sig); return; } // nothing is sent, so nothing to confirm
        const page = await this.fetchText(`${this.opts.baseUrl}/candidateswise-${this.opts.stateCode}${r.constNo}.htm`);
        if (page.status !== 200) return;
        const mapped = mapCandidates(seat, parseCandidateDetailPage(page.text), this.roster!.parties, this.opts.partyAliases ?? {});
        if ('reason' in mapped) { console.warn(`[${this.id}] seat ${r.constNo} ${seat.name}: ${mapped.reason}`); return; }
        pending.signature.set(r.constNo, sig);
        if (state === 'declared') {
          if (!this.declaredAt.has(r.constNo)) pending.declaredAt.set(r.constNo, now);
          else if (now - this.declaredAt.get(r.constNo)! > RECHECK_DECLARED_MS) pending.rechecked.add(r.constNo);
        }
        out.push({ const_id: seat.const_id, state, round, votes: mapped.votes });
      } catch (e) {
        console.warn(`[${this.id}] seat ${r.constNo} ${seat.name}: fetch failed: ${(e as Error).message}`);
      }
    });
    return out.sort((a, b) => a.const_id.localeCompare(b.const_id));
  }

  async tally(): Promise<PartyTally[] | null> {
    if (!this.roster) return null;
    const page = await this.fetchText(`${this.opts.baseUrl}/partywiseresult-${this.opts.stateCode}.htm`);
    if (page.status !== 200) return null;
    const out: PartyTally[] = [];
    const unmapped: string[] = [];
    for (const r of parsePartywisePage(page.text)) {
      const id = mapParty(r.party, this.roster.parties, this.opts.partyAliases ?? {});
      if (id) out.push({ party_id: id, won: r.won, leading: r.leading });
      else if (r.won || r.leading) unmapped.push(`${r.party} (${r.won}/${r.leading})`);
    }
    // An unmapped party's seats would otherwise show as a silent tally mismatch; add a partyAliases entry for it.
    if (unmapped.length) console.warn(`[${this.id}] tally: ${unmapped.length} unmapped part${unmapped.length === 1 ? 'y' : 'ies'} (won/leading): ${unmapped.join(', ')}`);
    return out;
  }

  private async listRows(): Promise<ConstituencySummary[]> {
    const rows: ConstituencySummary[] = [];
    for (let n = 1; n <= MAX_PAGES; n++) {
      const cached = this.pages.get(n);
      const res = await this.fetchText(`${this.opts.baseUrl}/statewise${this.opts.stateCode}${n}.htm`, cached?.lastModified ?? undefined);
      if (res.status === 304 && cached) { rows.push(...cached.rows); continue; }
      if (res.status !== 200) break;
      const parsed = parseConstituencyListPage(res.text);
      if (!parsed.length) break;
      this.pages.set(n, { lastModified: res.lastModified, rows: parsed });
      rows.push(...parsed);
    }
    return rows;
  }
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
