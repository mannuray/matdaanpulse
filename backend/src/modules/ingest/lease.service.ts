// backend/src/modules/ingest/lease.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REST } from './shards.service';

export const LEASE_TTL_MS = 90_000;
/** The lease before a claim that changed hands (another key or holder name; expires_at NULL = it had been released). */
export type PreviousLease = { holder: string; key_id: string | null; expires_at: Date | null };
type Claim = { ok: true; expires_at: Date; previous: PreviousLease | null } | { ok: false; holder: string | null; expires_at: Date | null };
type Row = { expires: Date; prev_holder: string | null; prev_key: string | null; prev_expires: Date | null };

/**
 * One writer per shard: a conditional UPDATE … RETURNING, so concurrent claims cannot both win. The row is locked by
 * the FROM subquery (FOR UPDATE), so the previous holder it returns is the one this claim replaced.
 */
@Injectable()
export class LeaseService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(electionId: string, shard: string, keyId: string, holder: string, now = new Date()): Promise<Claim> {
    const exp = new Date(now.getTime() + LEASE_TTL_MS);
    let rows: Row[];
    if (shard === REST) {
      await this.prisma.$executeRaw`INSERT INTO election_ingest (election_id) VALUES (${electionId}::uuid) ON CONFLICT DO NOTHING`;
      rows = await this.prisma.$queryRaw`
        UPDATE election_ingest e SET rest_lease_holder = ${holder}, rest_lease_key_id = ${keyId}::uuid, rest_lease_expires_at = ${exp}
        FROM (SELECT election_id, rest_lease_holder AS h, rest_lease_key_id AS k, rest_lease_expires_at AS x
              FROM election_ingest WHERE election_id = ${electionId}::uuid FOR UPDATE) p
        WHERE e.election_id = p.election_id
          AND (e.rest_lease_expires_at IS NULL OR e.rest_lease_expires_at <= ${now}
               OR (e.rest_lease_key_id = ${keyId}::uuid AND e.rest_lease_holder = ${holder}))
        RETURNING e.rest_lease_expires_at AS expires, p.h AS prev_holder, p.k::text AS prev_key, p.x AS prev_expires`;
    } else {
      rows = await this.prisma.$queryRaw`
        UPDATE ingest_shards s SET lease_holder = ${holder}, lease_key_id = ${keyId}::uuid, lease_expires_at = ${exp}
        FROM (SELECT id, lease_holder AS h, lease_key_id AS k, lease_expires_at AS x
              FROM ingest_shards WHERE election_id = ${electionId}::uuid AND name = ${shard} FOR UPDATE) p
        WHERE s.id = p.id
          AND (s.lease_expires_at IS NULL OR s.lease_expires_at <= ${now}
               OR (s.lease_key_id = ${keyId}::uuid AND s.lease_holder = ${holder}))
        RETURNING s.lease_expires_at AS expires, p.h AS prev_holder, p.k::text AS prev_key, p.x AS prev_expires`;
    }
    if (rows.length) {
      const r = rows[0];
      const changed = r.prev_holder !== null && (r.prev_holder !== holder || r.prev_key !== keyId);
      return { ok: true, expires_at: r.expires, previous: changed ? { holder: r.prev_holder!, key_id: r.prev_key, expires_at: r.prev_expires } : null };
    }
    const cur = await this.current(electionId, shard);
    return { ok: false, holder: cur?.holder ?? null, expires_at: cur?.expires ?? null };
  }

  async release(electionId: string, shard: string, keyId: string, holder: string): Promise<void> {
    if (shard === REST) {
      await this.prisma.$executeRaw`UPDATE election_ingest SET rest_lease_expires_at = NULL
        WHERE election_id = ${electionId}::uuid AND rest_lease_key_id = ${keyId}::uuid AND rest_lease_holder = ${holder}`;
    } else {
      await this.prisma.$executeRaw`UPDATE ingest_shards SET lease_expires_at = NULL
        WHERE election_id = ${electionId}::uuid AND name = ${shard} AND lease_key_id = ${keyId}::uuid AND lease_holder = ${holder}`;
    }
  }

  async holds(electionId: string, shard: string, keyId: string, holder: string, now = new Date()): Promise<boolean> {
    const cur = await this.current(electionId, shard);
    return !!cur && cur.key === keyId && cur.holder === holder && !!cur.expires && cur.expires > now;
  }

  async current(electionId: string, shard: string): Promise<{ holder: string | null; key: string | null; expires: Date | null } | null> {
    if (shard === REST) {
      const r = await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } });
      return r ? { holder: r.rest_lease_holder, key: r.rest_lease_key_id, expires: r.rest_lease_expires_at } : null;
    }
    const r = await this.prisma.ingest_shards.findUnique({ where: { election_id_name: { election_id: electionId, name: shard } } });
    return r ? { holder: r.lease_holder, key: r.lease_key_id, expires: r.lease_expires_at } : null;
  }
}
