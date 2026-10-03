// backend/src/modules/ingest/lease.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REST } from './shards.service';

export const LEASE_TTL_MS = 90_000;
type Claim = { ok: true; expires_at: Date } | { ok: false; holder: string | null; expires_at: Date | null };

/** One writer per shard: a conditional UPDATE … RETURNING, so concurrent claims cannot both win. */
@Injectable()
export class LeaseService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(electionId: string, shard: string, keyId: string, holder: string, now = new Date()): Promise<Claim> {
    const exp = new Date(now.getTime() + LEASE_TTL_MS);
    let rows: { expires: Date }[];
    if (shard === REST) {
      await this.prisma.$executeRaw`INSERT INTO election_ingest (election_id) VALUES (${electionId}::uuid) ON CONFLICT DO NOTHING`;
      rows = await this.prisma.$queryRaw`
        UPDATE election_ingest SET rest_lease_holder = ${holder}, rest_lease_key_id = ${keyId}::uuid, rest_lease_expires_at = ${exp}
        WHERE election_id = ${electionId}::uuid
          AND (rest_lease_expires_at IS NULL OR rest_lease_expires_at <= ${now}
               OR (rest_lease_key_id = ${keyId}::uuid AND rest_lease_holder = ${holder}))
        RETURNING rest_lease_expires_at AS expires`;
    } else {
      rows = await this.prisma.$queryRaw`
        UPDATE ingest_shards SET lease_holder = ${holder}, lease_key_id = ${keyId}::uuid, lease_expires_at = ${exp}
        WHERE election_id = ${electionId}::uuid AND name = ${shard}
          AND (lease_expires_at IS NULL OR lease_expires_at <= ${now}
               OR (lease_key_id = ${keyId}::uuid AND lease_holder = ${holder}))
        RETURNING lease_expires_at AS expires`;
    }
    if (rows.length) return { ok: true, expires_at: rows[0].expires };
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
