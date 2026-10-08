/**
 * Every stored manifest (published `manifest_url` and any `manifest_draft`) must pass ManifestDraftDto, so an admin
 * can open, save and publish any seeded manifest unchanged after U3 (validated manifest drafts).
 *
 * Without a reachable database the test prints a "SKIPPED" warning and passes; REQUIRE_DB_TESTS=1 makes a
 * missing database a failure.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ManifestDraftDto } from './manifest-draft.dto';
import { parseManifest } from '../../../common/manifest';
import { flattenValidationErrors, ValidationFailedException } from '../../../common/validation/validation-failed.exception';

config({ path: join(__dirname, '../../../../../.env') });

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('stored manifests pass ManifestDraftDto (DB)', () => {
  let prisma: PrismaClient | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1 FROM elections LIMIT 1`;
      prisma = client;
    } catch {
      await client.$disconnect();
    }
  });

  afterAll(async () => prisma?.$disconnect());

  it('every published manifest and draft validates', async () => {
    if (!prisma) {
      if (REQUIRE_DB) throw new Error('REQUIRE_DB_TESTS=1 but no database is reachable');
      console.warn('SKIPPED (no database): stored manifests pass ManifestDraftDto');
      return;
    }
    const pipe = new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      exceptionFactory: (errors) => new ValidationFailedException(flattenValidationErrors(errors)),
    });
    const rows = await prisma.elections.findMany({ select: { id: true, name: true, manifest_url: true, manifest_draft: true } });
    const failures: string[] = [];
    let checked = 0;
    for (const row of rows) {
      for (const [which, raw] of [['manifest_url', row.manifest_url], ['manifest_draft', row.manifest_draft]] as const) {
        if (raw === null || raw === undefined) continue;
        const manifest = which === 'manifest_url' ? parseManifest(raw) : raw;
        checked++;
        try {
          await pipe.transform(manifest, { type: 'body', metatype: ManifestDraftDto });
        } catch (err) {
          const detail = err instanceof ValidationFailedException ? JSON.stringify(err.fields.slice(0, 3)) : (err as Error).message;
          failures.push(`${row.name} (${which}): ${err instanceof BadRequestException ? detail : err}`);
        }
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });
});
