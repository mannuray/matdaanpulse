import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShardsService } from './shards.service';
import { IngestService, type TallyMismatch } from './ingest.service';
import { ElectionNotFoundException } from '../../common/exceptions';

export interface ShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: Date | null;
  last_post_at: Date | null; last_applied_at: Date | null; lag_s: number | null; recent: Record<string, number>;
  /** Seats whose latest post was rejected by the seat rules (kept until the seat next goes through). */
  rejected: { const_id: string; reason: string }[];
  /** Requests refused as a whole in the last 5 minutes, by reason (no_lease / inactive_source / not_live). */
  refused: Record<string, number>;
  tally_mismatch: TallyMismatch[] | null;
  /** The latest change of lease holder in the last 10 minutes (audit INGEST_LEASE_TAKEOVER), or null. */
  takeover: LeaseTakeover | null }
export interface LeaseTakeover { from: string | null; to: string | null; at: Date; after: 'expiry' | 'release' }
export interface IngestAlert { key: string; level: 'warn' | 'error'; election_id: string; shard: string; message: string }

const LAG_S = 180;
const LEASE_GRACE_MS = 120_000;
const RECENT_POSTS = 10;
export const REFUSED_WINDOW_MS = 5 * 60_000;
export const TAKEOVER_WINDOW_MS = 10 * 60_000;

type AuditReader = { audit_logs: { findMany: (args: any) => Promise<{ timestamp: Date; old_value: unknown; new_value: unknown }[]> } };
const str = (v: unknown) => (typeof v === 'string' ? v : null);

/** Lease takeovers of the last 10 minutes, the latest per shard (written by IngestController.lease). */
export async function recentTakeovers(prisma: AuditReader, electionId: string, now: Date): Promise<Map<string, LeaseTakeover>> {
  const rows = await prisma.audit_logs.findMany({
    where: { action: 'INGEST_LEASE_TAKEOVER', entity_type: 'election', entity_id: electionId, timestamp: { gte: new Date(now.getTime() - TAKEOVER_WINDOW_MS) } },
    orderBy: { timestamp: 'desc' }, take: 50, select: { timestamp: true, old_value: true, new_value: true },
  });
  const out = new Map<string, LeaseTakeover>();
  for (const r of rows) {
    const before = (r.old_value ?? {}) as Record<string, unknown>;
    const after = (r.new_value ?? {}) as Record<string, unknown>;
    const shard = str(after.shard) ?? str(before.shard);
    if (!shard || out.has(shard)) continue;
    out.set(shard, { from: str(before.holder), to: str(after.holder), at: r.timestamp, after: before.expires_at ? 'expiry' : 'release' });
  }
  return out;
}

/** Spec §5 banners; pure so the thresholds are tested. */
export function alertsFor(s: ShardStatus, electionId: string, live: boolean, now: Date, prevTallyMismatch: boolean): IngestAlert[] {
  if (!live || s.seat_count === 0) return [];
  const out: IngestAlert[] = [];
  const a = (kind: string, level: IngestAlert['level'], message: string) => out.push({ key: `${electionId}:${s.name}:${kind}`, level, election_id: electionId, shard: s.name, message });
  if (s.lag_s !== null && s.lag_s > LAG_S) a('lag', 'warn', `Shard ${s.name} is ${Math.round(s.lag_s / 60)} min behind`);
  if (s.source && (!s.lease_expires_at || now.getTime() - s.lease_expires_at.getTime() > LEASE_GRACE_MS)) a('lease', 'error', `No job holds shard ${s.name}`);
  if (s.rejected.length) a('rejected', 'error', `${s.rejected.length} seat(s) rejected in shard ${s.name}`);
  const refused = Object.entries(s.refused).filter(([, n]) => n > 0).sort(([x], [y]) => x.localeCompare(y));
  if (refused.length) a('refused', 'error', `Shard ${s.name} refused: ${refused.map(([r, n]) => `${r} ×${n}`).join(', ')} in last 5 min`);
  if (s.tally_mismatch?.length && prevTallyMismatch) a('tally', 'warn', `Source tally differs from ours in shard ${s.name}`);
  // Keyed per takeover, so the webhook posts each one once.
  if (s.takeover) a(`takeover:${s.takeover.at.toISOString()}`, 'warn',
    `Shard ${s.name} changed hands: ${s.takeover.from ?? '?'} → ${s.takeover.to ?? '?'} (${s.takeover.after === 'expiry' ? 'after the lease expired' : 'after a release'})`);
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
    const takeovers = await recentTakeovers(this.prisma, electionId, now);
    for (const sh of await this.shards.list(electionId)) {
      // Refused requests are counted separately; they are not posts (no counts, and they must not hide lag).
      const posts = await this.prisma.ingest_log.findMany({ where: { election_id: electionId, shard: sh.name, kind: 'seats', dry_run: false, refused: null }, orderBy: { received_at: 'desc' }, take: RECENT_POSTS });
      const tallies = await this.prisma.ingest_log.findMany({ where: { election_id: electionId, shard: sh.name, kind: 'tally', refused: null }, orderBy: { received_at: 'desc' }, take: 2 });
      const refusedRows = await this.prisma.ingest_log.groupBy({ by: ['refused'], where: { election_id: electionId, shard: sh.name, refused: { not: null }, received_at: { gte: new Date(now.getTime() - REFUSED_WINDOW_MS) } }, _count: { _all: true } });
      const applied = await this.prisma.seat_ingest_state.aggregate({ where: { election_id: electionId, const_id: { in: sh.seat_ids } }, _max: { last_applied_at: true } });
      const rejected = await this.prisma.seat_ingest_state.findMany({ where: { election_id: electionId, const_id: { in: sh.seat_ids }, last_rejected_reason: { not: null } }, select: { const_id: true, last_rejected_reason: true }, orderBy: { const_id: 'asc' } });
      const source = await this.ingest.effectiveSource(electionId, sh);
      const recent: Record<string, number> = {};
      for (const p of posts) for (const [k, v] of Object.entries(p.counts as Record<string, number>)) recent[k] = (recent[k] ?? 0) + v;
      // Never posted while it has a source: lag counts from when the feed settings last changed, so a dead shard still alerts.
      const latestObs = posts[0]?.observed_at ?? (source ? settings?.updated_at ?? null : null);
      const s: ShardStatus = {
        name: sh.name, seat_count: sh.seat_ids.length, source,
        lease_holder: sh.lease_holder, lease_expires_at: sh.lease_expires_at,
        last_post_at: posts[0]?.received_at ?? null, last_applied_at: applied._max.last_applied_at ?? null,
        lag_s: latestObs ? Math.max(0, Math.round((now.getTime() - latestObs.getTime()) / 1000)) : null,
        recent, rejected: rejected.map(r => ({ const_id: r.const_id, reason: r.last_rejected_reason! })),
        refused: Object.fromEntries(refusedRows.map(r => [r.refused!, r._count._all])),
        tally_mismatch: (tallies[0]?.tally_mismatch as TallyMismatch[] | null) ?? null,
        takeover: takeovers.get(sh.name) ?? null,
      };
      shards.push(s);
      alerts.push(...alertsFor(s, electionId, live, now, !!(tallies[1]?.tally_mismatch as unknown[] | null)?.length));
    }
    return { election_id: electionId, status: String(election.status), active_source: settings?.active_source ?? null, hold_minutes: settings?.hold_minutes ?? 10, shards, alerts };
  }
}
