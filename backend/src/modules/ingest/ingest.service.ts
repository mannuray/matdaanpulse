import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultChangeNotifier, type ChangedRow } from '../live/result-change-notifier';
import { ShardsService, REST } from './shards.service';
import { LeaseService } from './lease.service';
import { evaluateSeat, type IncomingSeat, type RosterCandidate, type SeatOutcome, type SeatState, type StoredRow, type StoredSeat } from './seat-rules';
import { ElectionNotFoundException, IngestBadRequestException, IngestInactiveSourceException, IngestNoLeaseException, IngestNotLiveException } from '../../common/exceptions';
import type { SeatsBody } from './dto/ingest.dto';

export interface Roster {
  election: { id: string; type: string; state_id: number | null; year: number; status: string };
  parties: { id: string; name: string; abbreviation: string | null }[];
  seats: { const_id: string; const_no: number; name: string; type: string; state_id: number | null; candidates: { candidate_id: string; name: string; party_id: string | null }[] }[];
}
export interface IngestConfig { status: string; source: string | null; poll_hint_ms: number; shard: { name: string; seat_count: number }; lease: { holder: string | null; expires_at: Date | null } }
export type SeatOutcomeName = 'applied' | 'unchanged' | 'stale' | 'held' | 'rejected';
export interface SeatsResponse { counts: Record<SeatOutcomeName, number>; seats: { const_id: string; outcome: SeatOutcomeName; reason?: string; detail?: Record<string, unknown> }[] }

const FUTURE_SLACK_MS = 2 * 60_000;
const POLL_HINT_MS = 30_000;
const TX = { timeout: 60_000, maxWait: 10_000 };

type Evaluated = { seat: IncomingSeat; outcome: SeatOutcome | { kind: 'rejected'; reason: string; detail?: Record<string, unknown> } };

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
    return {
      election: { ...election, type: String(election.type), status: String(election.status) },
      parties,
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
    if (!dry && election.status !== 'Live') throw new IngestNotLiveException(String(election.status));
    const shard = await this.shards.get(electionId, body.shard);
    const source = await this.effectiveSource(electionId, shard);
    if (!dry && body.source !== source) throw new IngestInactiveSourceException(source);
    if (!dry && !(await this.leases.holds(electionId, shard.name, key.id, body.holder, now))) {
      const cur = await this.leases.current(electionId, shard.name);
      throw new IngestNoLeaseException(cur?.holder ?? null, cur?.expires ?? null);
    }

    const inShard = new Set(shard.seat_ids);
    const ids = [...new Set(body.seats.map(s => s.const_id).filter(id => inShard.has(id)))];
    const [cands, states, rows, holds] = await Promise.all([
      this.prisma.candidates.findMany({ where: { election_id: electionId, const_id: { in: ids } }, select: { id: true, const_id: true, party_id: true } }),
      this.prisma.seat_ingest_state.findMany({ where: { election_id: electionId, const_id: { in: ids } } }),
      this.prisma.results.findMany({ where: { election_id: electionId, const_id: { in: ids } }, select: { candidate_id: true, const_id: true, votes: true, status: true, margin: true } }),
      this.prisma.seat_holds.findMany({ where: { election_id: electionId, const_id: { in: ids } } }),
    ]);
    const rosterOf = group(cands, c => c.const_id, (c): RosterCandidate => ({ candidate_id: c.id, party_id: c.party_id }));
    const rowsOf = group(rows, r => r.const_id, (r): StoredRow => ({ candidate_id: r.candidate_id, votes: r.votes, status: r.status as StoredRow['status'], margin: r.margin }));
    const stateOf = new Map(states.map(s => [s.const_id, s]));
    const holdOf = new Map(holds.map(h => [h.const_id, h]));

    const seen = new Set<string>();
    const evaluated: Evaluated[] = body.seats.map(raw => {
      const seat: IncomingSeat = { const_id: raw.const_id, state: raw.state, round: raw.round ?? null, votes: raw.votes };
      if (!inShard.has(seat.const_id)) return { seat, outcome: { kind: 'rejected', reason: 'not_in_shard' } };
      if (seen.has(seat.const_id)) return { seat, outcome: { kind: 'rejected', reason: 'duplicate_seat' } };
      seen.add(seat.const_id);
      const st = stateOf.get(seat.const_id);
      const stored: StoredSeat | null = st ? { state: st.state as SeatState, round_current: st.round_current, round_total: st.round_total, last_source: st.last_source, last_observed_at: st.last_observed_at } : null;
      const h = holdOf.get(seat.const_id);
      return { seat, outcome: evaluateSeat({ seat, roster: rosterOf.get(seat.const_id) ?? [], stored, storedRows: rowsOf.get(seat.const_id) ?? [], hold: h ? { round_at_hold: h.round_at_hold, expires_at: h.expires_at } : null, source: body.source, observedAt, now }) };
    });

    const response = summarise(evaluated);
    const log = { election_id: electionId, shard: shard.name, key_id: key.id, source: body.source, dry_run: dry, observed_at: observedAt,
      counts: response.counts as unknown as Prisma.InputJsonValue,
      rejected: response.seats.filter(s => s.outcome === 'rejected').map(s => ({ const_id: s.const_id, reason: s.reason })) as unknown as Prisma.InputJsonValue };
    if (dry) {
      await this.prisma.ingest_log.create({ data: log });
      return response;
    }
    await this.prisma.$transaction(async tx => {
      await this.write(tx as any, electionId, evaluated, body.source, observedAt, now);
      await (tx as any).ingest_log.create({ data: log });
    }, TX);

    const changed = changedRows(evaluated, rosterOf);
    if (changed.length) await this.notifier.afterCommit(electionId, changed, { kind: 'batch' });
    return response;
  }

  /** One transaction: results rows, rounds, seat state, released holds. Unchanged seats only advance their observation. */
  async write(tx: PrismaService, electionId: string, evaluated: Evaluated[], source: string, observedAt: Date, now: Date): Promise<void> {
    const applied = evaluated.filter(e => e.outcome.kind === 'applied') as { seat: IncomingSeat; outcome: Extract<SeatOutcome, { kind: 'applied' }> }[];
    const touched = evaluated.filter(e => e.outcome.kind === 'applied' || e.outcome.kind === 'unchanged');
    const released = evaluated.filter(e => (e.outcome.kind === 'applied' || e.outcome.kind === 'unchanged') && (e.outcome as any).releaseHold).map(e => e.seat.const_id);

    const flat = applied.flatMap(a => a.outcome.rows.map(r => ({ ...r, round: a.seat.round?.current ?? null })));
    if (flat.length) {
      await tx.$executeRaw`
        UPDATE results AS r SET votes = u.votes, status = u.status::result_status, margin = u.margin,
               round_no = COALESCE(u.round_no, r.round_no), last_updated = ${now}
        FROM UNNEST(${flat.map(r => r.candidate_id)}::uuid[], ${flat.map(r => r.votes)}::int[], ${flat.map(r => r.status)}::text[],
                    ${flat.map(r => r.margin)}::int[], ${flat.map(r => r.round)}::int[]) AS u(cid, votes, status, margin, round_no)
        WHERE r.candidate_id = u.cid AND r.election_id = ${electionId}::uuid`;
    }
    const withRound = applied.filter(a => a.seat.round);
    if (withRound.length) {
      await tx.$executeRaw`
        UPDATE constituencies AS c SET current_round = u.cr, total_rounds = u.tr
        FROM UNNEST(${withRound.map(a => a.seat.const_id)}::varchar[], ${withRound.map(a => a.seat.round!.current)}::int[], ${withRound.map(a => a.seat.round!.total)}::int[]) AS u(id, cr, tr)
        WHERE c.id = u.id AND c.election_id = ${electionId}::uuid`;
    }
    if (touched.length) {
      await tx.$executeRaw`
        INSERT INTO seat_ingest_state (election_id, const_id, state, round_current, round_total, last_source, last_observed_at, last_applied_at)
        SELECT ${electionId}::uuid, u.id, u.state, u.rc, u.rt, ${source}, ${observedAt}, CASE WHEN u.applied THEN ${now}::timestamptz END
        FROM UNNEST(${touched.map(t => t.seat.const_id)}::varchar[], ${touched.map(t => t.seat.state)}::text[],
                    ${touched.map(t => t.seat.round?.current ?? null)}::int[], ${touched.map(t => t.seat.round?.total ?? null)}::int[],
                    ${touched.map(t => t.outcome.kind === 'applied')}::bool[]) AS u(id, state, rc, rt, applied)
        ON CONFLICT (election_id, const_id) DO UPDATE SET
          state = EXCLUDED.state, round_current = EXCLUDED.round_current, round_total = EXCLUDED.round_total,
          last_source = EXCLUDED.last_source, last_observed_at = EXCLUDED.last_observed_at,
          last_applied_at = COALESCE(EXCLUDED.last_applied_at, seat_ingest_state.last_applied_at)`;
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
    const ranked = outcome.rows.filter(r => party.get(r.candidate_id) !== 'NOTA');
    const lead = ranked.find(r => r.status === 'LEADING' || r.status === 'WON') ?? [...ranked].sort((a, b) => b.votes - a.votes)[0];
    const p = lead ? party.get(lead.candidate_id) : null;
    if (!lead || !p) continue;
    out.push({ const_id: seat.const_id, p, m: lead.margin, s: lead.status, ...(seat.round ? { r: seat.round.current, cr: seat.round.current, tr: seat.round.total } : {}) });
  }
  return out;
}

export { REST };
