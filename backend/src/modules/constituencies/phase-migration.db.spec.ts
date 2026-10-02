/**
 * Integration check against the local database: migration 017's phase statements (copy
 * metadata->>'phase' into the column, then drop the key) can run again on every setup.sh
 * without bringing back a phase an admin cleared. Every change is rolled back.
 *
 * Without a reachable database the test prints a "SKIPPED" warning and passes; REQUIRE_DB_TESTS=1
 * makes a missing database a failure (as in audit-log.db.spec.ts).
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });

class Rollback extends Error {}

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';
const MIGRATION = join(__dirname, '../../../../database/migrations/017_record_pages.sql');

/** The `UPDATE constituencies …;` statements of migration 017, in file order. */
function phaseStatements(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8').replace(/^\s*--.*$/gm, '');
  return sql.match(/UPDATE constituencies[\s\S]*?;/g) ?? [];
}

describe('migration 017 phase copy (DB)', () => {
  let prisma: PrismaClient | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT updated_at FROM constituencies LIMIT 1`;
      prisma = client;
    } catch {
      await client.$disconnect();
    }
  });

  afterAll(async () => prisma?.$disconnect());

  it('has the copy and the strip, in that order', () => {
    const [copy, strip] = phaseStatements();
    expect(phaseStatements()).toHaveLength(2);
    expect(copy).toMatch(/SET phase = /);
    expect(strip).toMatch(/SET metadata = metadata - 'phase'/);
  });

  it('a phase cleared after the first run stays NULL when the migration runs again', async () => {
    if (!prisma) {
      if (REQUIRE_DB) throw new Error('REQUIRE_DB_TESTS=1 but no database with migration 017 is reachable');
      console.warn('SKIPPED (no database with migration 017): phase re-run');
      return;
    }
    const runMigration = async (tx: any) => {
      for (const stmt of phaseStatements()) await tx.$executeRawUnsafe(stmt);
    };
    await prisma
      .$transaction(async (tx) => {
        const { id } = (await tx.constituencies.findFirst({ select: { id: true } }))!;
        const read = async () => (await tx.$queryRaw<{ phase: number | null; has_key: boolean }[]>`
          SELECT phase, coalesce(metadata ? 'phase', false) AS has_key FROM constituencies WHERE id = ${id}`)[0];
        // A legacy seat: phase only in metadata.
        await tx.$executeRaw`UPDATE constituencies
          SET phase = NULL, metadata = coalesce(metadata, '{}'::jsonb) || '{"phase":" 3 "}'::jsonb WHERE id = ${id}`;
        await runMigration(tx);
        expect(await read()).toEqual({ phase: 3, has_key: false });
        // The admin sets "Not set".
        await tx.$executeRaw`UPDATE constituencies SET phase = NULL WHERE id = ${id}`;
        await runMigration(tx);
        expect(await read()).toEqual({ phase: null, has_key: false });
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
  });
});
