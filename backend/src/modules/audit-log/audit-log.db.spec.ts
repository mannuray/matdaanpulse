/**
 * Integration check against the local database (migration 017): a failed audit insert inside an
 * interactive transaction leaves the transaction usable (savepoint), and the updated_at trigger
 * only fires on real changes. Every change is rolled back.
 *
 * Without a reachable database the tests print a "SKIPPED" warning and pass; REQUIRE_DB_TESTS=1
 * makes a missing database a failure (as in live-version.db.spec.ts).
 */
import { config } from 'dotenv';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditLogService } from './audit-log.service';

config({ path: join(__dirname, '../../../.env') });

class Rollback extends Error {}

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('audit savepoint + updated_at trigger (DB)', () => {
  let prisma: PrismaClient | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT updated_at FROM parties LIMIT 1`;
      prisma = client;
    } catch {
      await client.$disconnect();
    }
  });

  afterAll(async () => prisma?.$disconnect());

  async function inRollbackTx(name: string, body: (tx: any, db: PrismaClient) => Promise<void>) {
    if (!prisma) {
      if (REQUIRE_DB) throw new Error(`REQUIRE_DB_TESTS=1 but no database with migration 017 is reachable (${name})`);
      console.warn(`SKIPPED (no database with migration 017): ${name}`);
      return;
    }
    const db = prisma;
    await db
      .$transaction(async (tx) => {
        await body(tx, db);
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  it('a failing audit insert (unknown user, FK violation) is rolled back to its savepoint; the transaction goes on', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await inRollbackTx('audit savepoint', async (tx, db) => {
      const party = await tx.parties.findFirst({ select: { id: true, leader_name: true } });
      const before = await tx.audit_logs.count();
      await new AuditLogService(db as any).record(
        { userId: '00000000-0000-0000-0000-000000000000', action: 'PARTY_UPDATE', entityType: 'party', entityId: party.id, newValue: { x: 1 } },
        tx,
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('PARTY_UPDATE'));
      // Would throw "current transaction is aborted" without the savepoint.
      await tx.parties.update({ where: { id: party.id }, data: { leader_name: `${party.leader_name ?? ''}x` } });
      expect(await tx.audit_logs.count()).toBe(before);
    });
    warn.mockRestore();
  });

  it('updated_at moves on a real change only (a no-op or an updated_at-only UPDATE keeps it)', async () => {
    await inRollbackTx('updated_at trigger', async (tx) => {
      const { id, updated_at: t0 } = await tx.parties.findFirst({ select: { id: true, updated_at: true } });
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
      expect(t0.getTime()).toBeLessThan(now.getTime());
      const read = async () => (await tx.parties.findUnique({ where: { id }, select: { updated_at: true } })).updated_at.getTime();
      await tx.$executeRaw`UPDATE parties SET name = name WHERE id = ${id}`;
      expect(await read()).toBe(t0.getTime());
      await tx.$executeRaw`UPDATE parties SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ${id}`;
      expect(await read()).toBe(t0.getTime());
      await tx.$executeRaw`UPDATE parties SET description = coalesce(description, '') || ' ' WHERE id = ${id}`;
      expect(await read()).toBe(now.getTime());
    });
  });
});
