import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultChangeNotifier } from '../live/result-change-notifier';
import { HoldsService } from './holds.service';
import { lockSeats } from './seat-lock';
import { checkRoster, deriveRows, missingResultRows, sameAsStored, type IncomingSeat, type SeatState, type StoredRow } from './seat-rules';
import { ElectionNotFoundException, IngestBadRequestException, IngestNotLiveException } from '../../common/exceptions';

export const ADMIN_SOURCE = 'admin';

/** Spec §6: an admin's seat correction — same derive rules as ingest, no source/lease/freshness, always holds the seat. */
@Injectable()
export class SeatCorrectionService {
  constructor(private readonly prisma: PrismaService, private readonly holds: HoldsService, private readonly notifier: ResultChangeNotifier) {}

  async correct(electionId: string, constId: string, input: { state: SeatState; round?: { current: number; total: number } | null; votes: Record<string, number> }, userId: string | null, now = new Date()) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    if (election.status !== 'Live') throw new IngestNotLiveException(String(election.status));
    const roster = (await this.prisma.candidates.findMany({ where: { election_id: electionId, const_id: constId }, select: { id: true, party_id: true } })).map(c => ({ candidate_id: c.id, party_id: c.party_id }));
    const seat: IncomingSeat = { const_id: constId, state: input.state, round: input.round ?? null, votes: input.votes };
    const bad = checkRoster(seat, roster);
    if (bad) throw new IngestBadRequestException(bad.reason, bad.detail);
    const rows = deriveRows(seat, roster);
    if (!Array.isArray(rows)) throw new IngestBadRequestException(rows.reason);
    const minutes = (await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } }))?.hold_minutes ?? 10;

    // Under the seat lock (shared with ingest), so an ingest batch for this seat either finished before this read or waits for the hold.
    let expires: Date = now;
    let changed = false;
    await this.prisma.$transaction(async (tx: any) => {
      await lockSeats(tx, electionId, [constId]);
      const storedRows = (await tx.results.findMany({ where: { election_id: electionId, const_id: constId }, select: { candidate_id: true, votes: true, status: true, margin: true } })) as StoredRow[];
      const missing = missingResultRows(roster, storedRows);
      if (missing.length) throw new IngestBadRequestException('missing_result_rows', { missing });
      const st = await tx.seat_ingest_state.findUnique({ where: { election_id_const_id: { election_id: electionId, const_id: constId } } });
      const stored = st ? { state: st.state as SeatState | null, round_current: st.round_current, round_total: st.round_total, last_source: st.last_source, last_observed_at: st.last_observed_at } : null;
      changed = !sameAsStored(rows, seat, storedRows, stored);
      const roundAtHold = seat.round?.current ?? st?.round_current ?? null;
      if (changed) {
        await tx.$executeRaw`
          UPDATE results AS r SET votes = u.votes, status = u.status::result_status, margin = u.margin,
                 round_no = COALESCE(${seat.round?.current ?? null}::int, r.round_no), last_updated = ${now}
          FROM UNNEST(${rows.map(r => r.candidate_id)}::uuid[], ${rows.map(r => r.votes)}::int[], ${rows.map(r => r.status)}::text[], ${rows.map(r => r.margin)}::int[]) AS u(cid, votes, status, margin)
          WHERE r.candidate_id = u.cid AND r.election_id = ${electionId}::uuid`;
        if (seat.round) {
          await tx.$executeRaw`UPDATE constituencies SET current_round = ${seat.round.current}, total_rounds = ${seat.round.total} WHERE id = ${constId} AND election_id = ${electionId}::uuid`;
        }
        await tx.$executeRaw`
          INSERT INTO seat_ingest_state (election_id, const_id, state, round_current, round_total, last_source, last_observed_at, last_applied_at)
          VALUES (${electionId}::uuid, ${constId}, ${seat.state}, ${seat.round?.current ?? null}, ${seat.round?.total ?? null}, ${ADMIN_SOURCE}, ${now}, ${now})
          ON CONFLICT (election_id, const_id) DO UPDATE SET state = EXCLUDED.state,
            round_current = COALESCE(EXCLUDED.round_current, seat_ingest_state.round_current),
            round_total = COALESCE(EXCLUDED.round_total, seat_ingest_state.round_total),
            last_source = EXCLUDED.last_source, last_observed_at = EXCLUDED.last_observed_at, last_applied_at = EXCLUDED.last_applied_at`;
        await tx.audit_logs.create({ data: { user_id: userId, action: 'RESULT_SEAT_CORRECTION', entity_type: 'constituency', entity_id: constId,
          old_value: Object.fromEntries(storedRows.map(r => [r.candidate_id, r.votes])) as Prisma.InputJsonValue,
          new_value: { state: seat.state, round: seat.round ?? null, votes: seat.votes } as Prisma.InputJsonValue } });
      }
      expires = await this.holds.upsert(tx, electionId, constId, roundAtHold, minutes, userId, now);
    });

    if (changed) {
      const party = new Map(roster.map(c => [c.candidate_id, c.party_id]));
      const lead = rows.filter(r => party.get(r.candidate_id) !== 'NOTA').sort((a, b) => b.votes - a.votes)[0];
      const p = lead ? party.get(lead.candidate_id) : null;
      if (lead && p) await this.notifier.afterCommit(electionId, [{ const_id: constId, p, m: lead.margin, s: lead.status, ...(seat.round ? { cr: seat.round.current, tr: seat.round.total } : {}) }], { kind: 'single' });
    }
    return { outcome: changed ? 'applied' as const : 'unchanged' as const, hold_expires_at: expires };
  }
}
