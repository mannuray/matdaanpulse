import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShardsService } from './shards.service';
import { IngestService, type TallyMismatch } from './ingest.service';
import { ElectionNotFoundException } from '../../common/exceptions';

export interface ShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: Date | null;
  last_post_at: Date | null; last_applied_at: Date | null; lag_s: number | null; recent: Record<string, number>; rejected: { const_id: string; reason: string }[]; tally_mismatch: TallyMismatch[] | null }
export interface IngestAlert { key: string; level: 'warn' | 'error'; election_id: string; shard: string; message: string }

const LAG_S = 180;
const LEASE_GRACE_MS = 120_000;
const RECENT_POSTS = 10;

/** Spec §5 banners; pure so the thresholds are tested. */
export function alertsFor(s: ShardStatus, electionId: string, live: boolean, now: Date, prevTallyMismatch: boolean): IngestAlert[] {
  if (!live || s.seat_count === 0) return [];
  const out: IngestAlert[] = [];
  const a = (kind: string, level: IngestAlert['level'], message: string) => out.push({ key: `${electionId}:${s.name}:${kind}`, level, election_id: electionId, shard: s.name, message });
  if (s.lag_s !== null && s.lag_s > LAG_S) a('lag', 'warn', `Shard ${s.name} is ${Math.round(s.lag_s / 60)} min behind`);
  if (s.source && (!s.lease_expires_at || now.getTime() - s.lease_expires_at.getTime() > LEASE_GRACE_MS)) a('lease', 'error', `No job holds shard ${s.name}`);
  if (s.rejected.length) a('rejected', 'error', `${s.rejected.length} seat(s) rejected in shard ${s.name}`);
  if (s.tally_mismatch?.length && prevTallyMismatch) a('tally', 'warn', `Source tally differs from ours in shard ${s.name}`);
  return out;
}

@Injectable()
export class IngestStatusService {
  constructor(private readonly prisma: PrismaService, private readonly shards: ShardsService, private readonly ingest: IngestService) {}

  async status(electionId: string, now = new Date()) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const settings = await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } });
    const live = election.status === 'Live';
    const shards: ShardStatus[] = [];
    const alerts: IngestAlert[] = [];
    for (const sh of await this.shards.list(electionId)) {
      const posts = await this.prisma.ingest_log.findMany({ where: { election_id: electionId, shard: sh.name, kind: 'seats', dry_run: false }, orderBy: { received_at: 'desc' }, take: RECENT_POSTS });
      const tallies = await this.prisma.ingest_log.findMany({ where: { election_id: electionId, shard: sh.name, kind: 'tally' }, orderBy: { received_at: 'desc' }, take: 2 });
      const applied = await this.prisma.seat_ingest_state.aggregate({ where: { election_id: electionId, const_id: { in: sh.seat_ids } }, _max: { last_applied_at: true } });
      const recent: Record<string, number> = {};
      for (const p of posts) for (const [k, v] of Object.entries(p.counts as Record<string, number>)) recent[k] = (recent[k] ?? 0) + v;
      const latestObs = posts[0]?.observed_at ?? null;
      const s: ShardStatus = {
        name: sh.name, seat_count: sh.seat_ids.length, source: await this.ingest.effectiveSource(electionId, sh),
        lease_holder: sh.lease_holder, lease_expires_at: sh.lease_expires_at,
        last_post_at: posts[0]?.received_at ?? null, last_applied_at: applied._max.last_applied_at ?? null,
        lag_s: latestObs ? Math.max(0, Math.round((now.getTime() - latestObs.getTime()) / 1000)) : null,
        recent, rejected: (posts[0]?.rejected as { const_id: string; reason: string }[] | undefined) ?? [],
        tally_mismatch: (tallies[0]?.tally_mismatch as TallyMismatch[] | null) ?? null,
      };
      shards.push(s);
      alerts.push(...alertsFor(s, electionId, live, now, !!(tallies[1]?.tally_mismatch as unknown[] | null)?.length));
    }
    return { election_id: electionId, status: String(election.status), active_source: settings?.active_source ?? null, hold_minutes: settings?.hold_minutes ?? 10, shards, alerts };
  }
}
