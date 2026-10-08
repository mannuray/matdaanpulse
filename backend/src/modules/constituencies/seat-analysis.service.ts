import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_TTL } from '../redis/cache.service';
import { electionKeys } from '../redis/election-cache.service';
import { analyse, baselineOf, SCHEMA_VERSION, type Baseline, type ElectionAnalysis } from '../../common/seat-analysis';
import { SeatAnalysisLoader } from './seat-analysis.loader';

export const publicAnalysisKey = electionKeys.publicAnalysis;
export const analysisSummaryKey = electionKeys.analysisSummary;
export const baselineKey = electionKeys.baseline;

/**
 * The one path that computes and stores the seat analysis (spec §4.5): the admin button, the compute endpoint, the CLI
 * and finalizing an election all call compute(). Upserts; never touches the admin-edited `notes`.
 */
@Injectable()
export class SeatAnalysisService {
  constructor(private readonly prisma: PrismaService, private readonly loader: SeatAnalysisLoader, private readonly cache: CacheService) {}

  async compute(electionId: string): Promise<{ computed: number }> {
    const { seats, election } = analyse(await this.loader.load(electionId));
    const rows = seats.map(s => ({ const_id: s.const_id, dominance: s.class?.kind ?? null, dominance_party: s.class?.holder ?? null, data: s }));
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO constituency_analysis (const_id, election_id, dominance, dominance_party, data, schema_version, computed_at, updated_at)
        SELECT x->>'const_id', ${electionId}::uuid, x->>'dominance', x->>'dominance_party', x->'data', ${SCHEMA_VERSION}::smallint, now(), now()
        FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) AS x
        ON CONFLICT (const_id, election_id) DO UPDATE SET
          dominance = EXCLUDED.dominance, dominance_party = EXCLUDED.dominance_party, data = EXCLUDED.data,
          schema_version = EXCLUDED.schema_version, computed_at = EXCLUDED.computed_at, updated_at = EXCLUDED.updated_at`;
      await tx.election_analysis.upsert({
        where: { election_id: electionId },
        create: { election_id: electionId, data: election as unknown as Prisma.InputJsonValue, schema_version: SCHEMA_VERSION },
        update: { data: election as unknown as Prisma.InputJsonValue, schema_version: SCHEMA_VERSION, computed_at: new Date() },
      });
    }, { timeout: 120_000 });
    await this.cache.del(publicAnalysisKey(electionId));
    await this.cache.del(analysisSummaryKey(electionId));
    return { computed: seats.length };
  }

  summary(electionId: string): Promise<ElectionAnalysis | null> {
    return this.cache.getOrSet(analysisSummaryKey(electionId), CACHE_TTL.PUBLIC_ANALYSIS, async () => {
      const row = await this.prisma.election_analysis.findUnique({ where: { election_id: electionId }, select: { data: true } });
      return (row?.data as unknown as ElectionAnalysis) ?? null;
    });
  }

  /** The pre-counting baseline (spec §5.1): computed on demand, and when an election goes Live. Leaves `data` untouched. */
  async computeBaseline(electionId: string): Promise<{ seats: number }> {
    const b = baselineOf(await this.loader.load(electionId));
    const now = new Date();
    await this.prisma.election_analysis.upsert({
      where: { election_id: electionId },
      create: { election_id: electionId, data: Prisma.DbNull, baseline: b as unknown as Prisma.InputJsonValue, schema_version: SCHEMA_VERSION, baseline_computed_at: now },
      update: { baseline: b as unknown as Prisma.InputJsonValue, baseline_computed_at: now },
    });
    await this.cache.del(baselineKey(electionId));
    return { seats: b.seats.length };
  }

  baseline(electionId: string): Promise<(Baseline & { computed_at: string }) | null> {
    return this.cache.getOrSet(baselineKey(electionId), CACHE_TTL.PUBLIC_ANALYSIS, async () => {
      const row = await this.prisma.election_analysis.findUnique({ where: { election_id: electionId }, select: { baseline: true, baseline_computed_at: true } });
      return row?.baseline ? { ...(row.baseline as unknown as Baseline), computed_at: row.baseline_computed_at!.toISOString() } : null;
    });
  }

  /** The admin button / compute endpoint / CLI: a Finalized election gets its final analysis, any other its baseline. */
  async computeFor(electionId: string): Promise<{ computed: number; kind: 'final' | 'baseline' }> {
    const e = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (e?.status === 'Finalized') return { ...(await this.compute(electionId)), kind: 'final' };
    return { computed: (await this.computeBaseline(electionId)).seats, kind: 'baseline' };
  }
}
