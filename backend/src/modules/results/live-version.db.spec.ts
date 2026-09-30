/**
 * Integration check of migration 015's triggers against the local database.
 * Skipped when no database is reachable (CI without Postgres). Every change is
 * rolled back.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });

class Rollback extends Error {}

describe('election_live_state triggers (DB)', () => {
  let prisma: PrismaClient | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1 FROM election_live_state LIMIT 1`;
      prisma = client;
    } catch {
      await client.$disconnect();
    }
  });

  afterAll(async () => prisma?.$disconnect());

  it('a results UPDATE that changes snapshot columns bumps the version inside the same transaction, monotonically; no-op updates do not', async () => {
    if (!prisma) return console.warn('skipped: no database with migration 015');
    const row = await prisma.results.findFirst({ select: { id: true, election_id: true } });
    if (!row) return console.warn('skipped: no results rows');
    const readVersion = async (tx: any) =>
      (await tx.election_live_state.findUnique({ where: { election_id: row.election_id } }))?.version ?? 0n;

    const seen: bigint[] = [];
    await prisma
      .$transaction(async (tx) => {
        seen.push(await readVersion(tx));
        await tx.$executeRaw`UPDATE results SET votes = votes + 1 WHERE id = ${row.id}::uuid`;
        seen.push(await readVersion(tx));
        await tx.$executeRaw`UPDATE results SET votes = votes - 1 WHERE id = ${row.id}::uuid`;
        seen.push(await readVersion(tx));
        await tx.$executeRaw`UPDATE results SET votes = votes WHERE id = '00000000-0000-0000-0000-000000000000'::uuid`;
        seen.push(await readVersion(tx)); // an UPDATE matching no rows does not bump
        await tx.$executeRaw`UPDATE results SET votes = votes WHERE id = ${row.id}::uuid`;
        seen.push(await readVersion(tx)); // a same-value UPDATE does not bump
        await tx.$executeRaw`UPDATE parties SET symbol_url = symbol_url`;
        seen.push(await readVersion(tx)); // columns not in snapshots do not bump
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
    expect(seen[1]).toBeGreaterThan(seen[0]);
    expect(seen[2]).toBeGreaterThan(seen[1]);
    expect(seen[3]).toBe(seen[2]);
    expect(seen[4]).toBe(seen[2]);
    expect(seen[5]).toBe(seen[2]);
  });
});
