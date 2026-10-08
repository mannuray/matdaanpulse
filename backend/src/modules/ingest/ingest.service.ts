import { leaderRow, writeSeats } from './seat-writer';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultChangeNotifier, type ChangedRow } from '../live/result-change-notifier';
import { ShardsService, REST } from './shards.service';
import { LeaseService } from './lease.service';
import { lockSeats } from './seat-lock';
import { seatTally } from '../../common/tally';
import { evaluateSeat, type IncomingSeat, type RosterCandidate, type SeatOutcome, type SeatState, type StoredRow, type StoredSeat } from './seat-rules';
import { ElectionNotFoundException, IngestBadRequestException, IngestInactiveSourceException, IngestNoLeaseException, IngestNotLiveException } from '../../common/exceptions';
import type { SeatsBody, TallyBody } from './dto/ingest.dto';

export interface Roster {
  election: { id: string; type: string; state_id: number | null; year: number; status: string };
  parties: { id: string; name: string; abbreviation: string | null }[];
  seats: { const_id: string; const_no: number; name: string; type: string; state_id: number | null; candidates: { candidate_id: string; name: string; party_id: string | null }[] }[];
  /** Seat analysis baseline: when computed, and whether a candidate changed since (live:check refuses a stale one). */
  baseline: { computed_at: string | null; stale: boolean };
}
export interface IngestConfig { status: string; source: string | null; poll_hint_ms: number; shard: { name: string; seat_count: number }; lease: { holder: string | null; expires_at: Date | null } }
export type SeatOutcomeName = 'applied' | 'unchanged' | 'stale' | 'held' | 'rejected';
export interface SeatsResponse { counts: Record<SeatOutcomeName, number>; seats: { const_id: string; outcome: SeatOutcomeName; reason?: string; detail?: Record<string, unknown> }[] }

export interface TallyMismatch { party_id: string; ours: { won: number; leading: number }; theirs: { won: number; leading: number } }

const FUTURE_SLACK_MS = 2 * 60_000;
const POLL_HINT_MS = 30_000;
const TX = { timeout: 60_000, maxWait: 10_000 };

/** `track`: a rejection by the seat rules for a seat of this shard, kept on seat_ingest_state until the seat next goes through. */
type Evaluated = { seat: IncomingSeat; outcome: SeatOutcome | { kind: 'rejected'; reason: string; detail?: Record<string, unknown> }; track?: boolean };
type Loaded = { stateOf: Map<string, { state: string | null; round_current: number | null; round_total: number | null; last_source: string | null; last_observed_at: Date | null }>;
  rowsOf: Map<string, StoredRow[]>; holdOf: Map<string, { round_at_hold: number | null; expires_at: Date }> };

async function loadSeats(db: Pick<Prisma.TransactionClient, 'seat_ingest_state' | 'results' | 'seat_holds'>, electionId: string, ids: string[]): Promise<Loaded> {
  const [states, rows, holds] = await Promise.all([
    db.seat_ingest_state.findMany({ where: { election_id: electionId, const_id: { in: ids } } }),
    db.results.findMany({ where: { election_id: electionId, const_id: { in: ids } }, select: { candidate_id: true, const_id: true, votes: true, status: true, margin: true } }),
    db.seat_holds.findMany({ where: { election_id: electionId, const_id: { in: ids } } }),
  ]);
  return {
    stateOf: new Map(states.map(s => [s.const_id, s])),
    rowsOf: group(rows, r => r.const_id, (r): StoredRow => ({ candidate_id: r.candidate_id, votes: r.votes, status: r.status as StoredRow['status'], margin: r.margin })),
    holdOf: new Map(holds.map(h => [h.const_id, h])),
  };
}

function evaluate(l: Loaded, c: { body: SeatsBody; inShard: Set<string>; rosterOf: Map<string, RosterCandidate[]>; observedAt: Date; now: Date }): Evaluated[] {
  const seen = new Set<string>();
  return c.body.seats.map((raw): Evaluated => {
    const seat: IncomingSeat = { const_id: raw.const_id, state: raw.state, round: raw.round ?? null, votes: raw.votes };
    if (!c.inShard.has(seat.const_id)) return { seat, outcome: { kind: 'rejected', reason: 'not_in_shard' } };
    if (seen.has(seat.const_id)) return { seat, outcome: { kind: 'rejected', reason: 'duplicate_seat' } };
    seen.add(seat.const_id);
    const st = l.stateOf.get(seat.const_id);
    const stored: StoredSeat | null = st ? { state: st.state as SeatState | null, round_current: st.round_current, round_total: st.round_total, last_source: st.last_source, last_observed_at: st.last_observed_at } : null;
    const h = l.holdOf.get(seat.const_id);
    const outcome = evaluateSeat({ seat, roster: c.rosterOf.get(seat.const_id) ?? [], stored, storedRows: l.rowsOf.get(seat.const_id) ?? [], hold: h ? { round_at_hold: h.round_at_hold, expires_at: h.expires_at } : null, source: c.body.source, observedAt: c.observedAt, now: c.now });
    return { seat, outcome, track: outcome.kind === 'rejected' };
  });
}

/** Spec §4: the machine-key API. Rules live in seat-rules.ts; this loads, writes and logs. */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly shards: ShardsService,
    private readonly leases: LeaseService,
    private readonly notifier: ResultChangeNotifier,
  ) {}

  async roster(electionId: string, shard?: string): Promise<Roster> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { id: true, type: true, state_id: true, year: true, status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const only = shard ? new Set((await this.shards.get(electionId, shard)).seat_ids) : null;
    const seats = await this.prisma.constituencies.findMany({
      where: { election_id: electionId }, orderBy: { const_no: 'asc' },
      select: { id: true, const_no: true, name: true, type: true, state_id: true },
    });
    const cands = await this.prisma.candidates.findMany({ where: { election_id: electionId }, select: { id: true, const_id: true, name: true, party_id: true }, orderBy: { name: 'asc' } });
    const partyIds = [...new Set(cands.map(c => c.party_id).filter((p): p is string => !!p))];
    const parties = await this.prisma.parties.findMany({ where: { id: { in: partyIds } }, select: { id: true, name: true, abbreviation: true }, orderBy: { id: 'asc' } });
    const byConst = new Map<string, Roster['seats'][number]['candidates']>();
    for (const c of cands) (byConst.get(c.const_id) ?? byConst.set(c.const_id, []).get(c.const_id)!).push({ candidate_id: c.id, name: c.name, party_id: c.party_id });
    const ea = await this.prisma.election_analysis.findUnique({ where: { election_id: electionId }, select: { baseline_computed_at: true } });
    const lastCand = await this.prisma.candidates.aggregate({ where: { election_id: electionId }, _max: { updated_at: true } });
    const at = ea?.baseline_computed_at ?? null;
    const baseline = { computed_at: at?.toISOString() ?? null, stale: !at || (!!lastCand._max.updated_at && lastCand._max.updated_at > at) };
    return {
      election: { ...election, type: String(election.type), status: String(election.status) },
      parties,
      baseline,
      seats: seats.filter(s => !only || only.has(s.id)).map(s => ({ const_id: s.id, const_no: s.const_no, name: s.name, type: String(s.type), state_id: s.state_id, candidates: byConst.get(s.id) ?? [] })),
    };
  }

  async effectiveSource(electionId: string, shard: { name: string; source_override: string | null }): Promise<string | null> {
    const ingest = await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } });
    if (!ingest?.active_source) return null;
    return shard.source_override ?? ingest.active_source;
  }

  async config(electionId: string, shardName: string): Promise<IngestConfig> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const shard = await this.shards.get(electionId, shardName);
    return {
      status: String(election.status), source: await this.effectiveSource(electionId, shard), poll_hint_ms: POLL_HINT_MS,
      shard: { name: shard.name, seat_count: shard.seat_ids.length },
      lease: { holder: shard.lease_holder, expires_at: shard.lease_expires_at },
    };
  }

  async ingestSeats(electionId: string, key: { id: string }, body: SeatsBody, now = new Date()): Promise<SeatsResponse> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const dry = !!body.dry_run;
    const observedAt = new Date(body.observed_at);
    if (observedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) throw new IngestBadRequestException('observed_at is in the future', { observed_at: body.observed_at });
    const shard = await this.shards.get(electionId, body.shard);
    if (!dry) await this.admit(electionId, String(election.status), shard, key, body.source, body.holder, 'seats', observedAt, now);

    const inShard = new Set(shard.seat_ids);
    const ids = [...new Set(body.seats.map(s => s.const_id).filter(id => inShard.has(id)))];
    const cands = await this.prisma.candidates.findMany({ where: { election_id: electionId, const_id: { in: ids } }, select: { id: true, const_id: true, party_id: true } });
    const rosterOf = group(cands, c => c.const_id, (c): RosterCandidate => ({ candidate_id: c.id, party_id: c.party_id }));
    const ctx = { body, inShard, rosterOf, observedAt, now };
    const logRow = (response: SeatsResponse) => ({ election_id: electionId, shard: shard.name, key_id: key.id, source: body.source, dry_run: dry, observed_at: observedAt,
      counts: response.counts as unknown as Prisma.InputJsonValue,
      rejected: response.seats.filter(s => s.outcome === 'rejected').map(s => ({ const_id: s.const_id, reason: s.reason })) as unknown as Prisma.InputJsonValue });

    if (dry) {
      const response = summarise(evaluate(await loadSeats(this.prisma, electionId, ids), ctx));
      await this.prisma.ingest_log.create({ data: logRow(response) });
      return response;
    }
    // Seat state, holds and results rows are read under the seat locks, so an admin correction committed after the
    // request arrived is seen here (its hold makes the seat held) and one still running waits for this batch.
    let evaluated: Evaluated[] = [];
    let response!: SeatsResponse;
    await this.prisma.$transaction(async tx => {
      await lockSeats(tx, electionId, ids);
      evaluated = evaluate(await loadSeats(tx, electionId, ids), ctx);
      response = summarise(evaluated);
      await this.write(tx, electionId, evaluated, body.source, observedAt, now);
      await tx.ingest_log.create({ data: logRow(response) });
    }, TX);

    const changed = changedRows(evaluated, rosterOf);
    if (changed.length) await this.notifier.afterCommit(electionId, changed, { kind: 'batch' });
    return response;
  }

  async tally(electionId: string, key: { id: string }, body: TallyBody, now = new Date()): Promise<{ mismatch: TallyMismatch[] }> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const shard = await this.shards.get(electionId, body.shard);
    const observedAt = new Date(body.observed_at);
    await this.admit(electionId, String(election.status), shard, key, body.source, body.holder, 'tally', observedAt, now);
    // A source's party-wise page covers the whole election, so the rest shard (or an explicit scope) compares every seat.
    const wholeElection = shard.name === REST || body.scope === 'election';
    const rows = await this.prisma.results.findMany({
      where: { election_id: electionId, ...(wholeElection ? {} : { const_id: { in: shard.seat_ids } }), status: { in: ['WON', 'LEADING'] } },
      select: { status: true, candidates: { select: { party_id: true } } },
    });
    const ours = seatTally(rows.map(r => ({ party_id: r.candidates.party_id, status: String(r.status) })));
    const theirs = new Map(body.parties.map(p => [p.party_id, { won: p.won, leading: p.leading }]));
    const mismatch: TallyMismatch[] = [];
    for (const id of new Set([...ours.keys(), ...theirs.keys()])) {
      const o = ours.get(id) ?? { won: 0, leading: 0 }, t = theirs.get(id) ?? { won: 0, leading: 0 };
      if (o.won !== t.won || o.leading !== t.leading) mismatch.push({ party_id: id, ours: o, theirs: t });
    }
    await this.prisma.ingest_log.create({ data: { election_id: electionId, shard: shard.name, key_id: key.id, source: body.source, kind: 'tally', observed_at: observedAt, tally_mismatch: (mismatch.length ? mismatch : null) as any } });
    return { mismatch };
  }

  /** Request-level checks for a real post. A refusal is logged (ingest_log.refused, counts {}) so the Live Console can alert on it, then thrown. */
  private async admit(electionId: string, status: string, shard: { name: string; source_override: string | null }, key: { id: string }, source: string, holder: string,
    kind: 'seats' | 'tally', observedAt: Date, now: Date): Promise<void> {
    let refused: { reason: 'not_live' | 'inactive_source' | 'no_lease'; error: Error } | null = null;
    if (status !== 'Live') refused = { reason: 'not_live', error: new IngestNotLiveException(status) };
    else {
      const active = await this.effectiveSource(electionId, shard);
      if (source !== active) refused = { reason: 'inactive_source', error: new IngestInactiveSourceException(active) };
      else if (!(await this.leases.holds(electionId, shard.name, key.id, holder, now))) {
        const cur = await this.leases.current(electionId, shard.name);
        refused = { reason: 'no_lease', error: new IngestNoLeaseException(cur?.holder ?? null, cur?.expires ?? null) };
      }
    }
    if (!refused) return;
    await this.prisma.ingest_log.create({ data: { election_id: electionId, shard: shard.name, key_id: key.id, source, kind, observed_at: observedAt, refused: refused.reason } })
      .catch(e => this.logger.warn(`ingest_log refusal row failed: ${(e as Error).message}`));
    throw refused.error;
  }

  /** One transaction: the results write (writeSeats: rows, rounds, seat state, timeline), released holds, seat rejections. */
  async write(tx: Pick<Prisma.TransactionClient, '$executeRaw'>, electionId: string, evaluated: Evaluated[], source: string, observedAt: Date, now: Date): Promise<void> {
    const applied = evaluated.filter(e => e.outcome.kind === 'applied') as { seat: IncomingSeat; outcome: Extract<SeatOutcome, { kind: 'applied' }> }[];
    const touched = evaluated.filter(e => e.outcome.kind === 'applied' || e.outcome.kind === 'unchanged');
    const released = evaluated.filter(e => (e.outcome.kind === 'applied' || e.outcome.kind === 'unchanged') && (e.outcome as any).releaseHold).map(e => e.seat.const_id);
    const rejected = evaluated.filter(e => e.outcome.kind === 'rejected' && e.track) as { seat: IncomingSeat; outcome: { kind: 'rejected'; reason: string } }[];

    await writeSeats(tx, electionId, {
      applied: applied.map(a => ({ const_id: a.seat.const_id, state: a.seat.state, round: a.seat.round ?? null, rows: a.outcome.rows })),
      unchanged: touched.filter(t => t.outcome.kind === 'unchanged').map(t => ({ const_id: t.seat.const_id, state: t.seat.state, round: t.seat.round ?? null })),
    }, source, observedAt, now, 'ingest');
    if (rejected.length) {
      // The seat's current rejection, kept until the seat is next applied or unchanged; a new row has no state (viewers do not see it).
      await tx.$executeRaw`
        INSERT INTO seat_ingest_state (election_id, const_id, last_rejected_reason, last_rejected_at)
        SELECT ${electionId}::uuid, u.id, u.reason, ${now}::timestamptz
        FROM UNNEST(${rejected.map(r => r.seat.const_id)}::varchar[], ${rejected.map(r => r.outcome.reason)}::text[]) AS u(id, reason)
        ON CONFLICT (election_id, const_id) DO UPDATE SET last_rejected_reason = EXCLUDED.last_rejected_reason, last_rejected_at = EXCLUDED.last_rejected_at`;
    }
    if (released.length) {
      await tx.$executeRaw`DELETE FROM seat_holds WHERE election_id = ${electionId}::uuid AND const_id = ANY(${released}::varchar[])`;
    }
  }
}

function group<T, V>(items: T[], key: (t: T) => string, map: (t: T) => V): Map<string, V[]> {
  const m = new Map<string, V[]>();
  for (const it of items) { const k = key(it); (m.get(k) ?? m.set(k, []).get(k)!).push(map(it)); }
  return m;
}

function summarise(evaluated: Evaluated[]): SeatsResponse {
  const counts: Record<SeatOutcomeName, number> = { applied: 0, unchanged: 0, stale: 0, held: 0, rejected: 0 };
  const seats: SeatsResponse['seats'] = [];
  for (const { seat, outcome } of evaluated) {
    counts[outcome.kind]++;
    if (outcome.kind === 'unchanged') continue;
    seats.push({ const_id: seat.const_id, outcome: outcome.kind, ...(outcome.kind === 'rejected' ? { reason: outcome.reason, ...(outcome.detail ? { detail: outcome.detail } : {}) } : {}) });
  }
  return { counts, seats };
}

/** One Live Console row per applied seat: the leader (or the top non-NOTA row when there is none). */
function changedRows(evaluated: Evaluated[], rosterOf: Map<string, RosterCandidate[]>): ChangedRow[] {
  const out: ChangedRow[] = [];
  for (const { seat, outcome } of evaluated) {
    if (outcome.kind !== 'applied') continue;
    const party = new Map((rosterOf.get(seat.const_id) ?? []).map(c => [c.candidate_id, c.party_id]));
    const lead = leaderRow(outcome.rows, party);
    const p = lead ? party.get(lead.candidate_id) : null;
    if (!lead || !p) continue;
    out.push({ const_id: seat.const_id, p, m: lead.margin, s: lead.status, ...(seat.round ? { r: seat.round.current, cr: seat.round.current, tr: seat.round.total } : {}) });
  }
  return out;
}

export { REST };
