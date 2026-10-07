import { paginated } from '../../common/paginated';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_TTL } from '../redis/cache.service';
import { Prisma } from '@prisma/client';
import { ConstituencyNotFoundException, ElectionNotFoundException, AnalysisNotFoundException } from '../../common/exceptions';
import type { UpdateAnalysisDto } from './dto/constituency-input.dto';
import { AuditLogService, type RecordAuditEntry } from '../audit-log/audit-log.service';
import { changedFields } from '../audit-log/audit-diff';

@Injectable()
export class ConstituenciesService {
  private readonly logger = new Logger(ConstituenciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditLogService,
  ) {}

  private async auditUpdate(before: object, after: object, id: string, userId?: string) {
    const diff = changedFields(before as Record<string, unknown>, after as Record<string, unknown>);
    if (diff) await this.audit.record({ userId, action: 'CONSTITUENCY_UPDATE', entityType: 'constituency', entityId: id, ...diff });
  }

  async findOneWithAnalysis(id: string) {
    const constituency = await this.prisma.constituencies.findUnique({
      where: { id },
      include: { districts: true, regions: true, elections: true, states: true },
    });
    if (!constituency) throw new ConstituencyNotFoundException(id);

    const analysis = await this.prisma.constituency_analysis.findUnique({
      where: { const_id_election_id: { const_id: id, election_id: constituency.election_id } },
    });

    return {
      ...constituency,
      district: constituency.districts,
      region: constituency.regions,
      election: constituency.elections,
      state: constituency.states,
      analysis: analysis || null,
    };
  }

  findByElection(electionId: string) {
    return this.prisma.constituencies.findMany({
      where: { election_id: electionId },
      orderBy: { const_no: 'asc' },
    });
  }

  async findByElectionWithAnalysis(electionId: string, page = 1, limit = 100, q?: string) {
    const skip = (page - 1) * limit;
    const where: any = { election_id: electionId };
    
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }

    const [total, constituencies] = await Promise.all([
      this.prisma.constituencies.count({ where }),
      this.prisma.constituencies.findMany({
        where,
        include: { districts: true, regions: true },
        orderBy: { const_no: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const analyses = await this.prisma.constituency_analysis.findMany({
      where: { election_id: electionId, const_id: { in: constituencies.map(c => c.id) } },
    });

    const analysisMap = new Map(analyses.map(a => [a.const_id, a]));

    const data = constituencies.map(c => ({
      ...c,
      district: c.districts,
      region: c.regions,
      analysis: analysisMap.get(c.id) || null,
    }));

    return paginated(data, { page, limit, total });
  }

  /**
   * `phase` is the only store of the polling phase (migration 017), so a `phase` key in a metadata patch is
   * dropped and the service never writes metadata.phase; the save itself still succeeds. A stored legacy key is
   * kept as it was: migration 017 strips the valid ones it copied, and leaves only unparseable values, which no
   * run ever copies into the column.
   */
  private static withoutPhase(patch: Record<string, any> | null | undefined): Record<string, any> {
    const { phase: _phase, ...rest } = (patch || {}) as Record<string, any>;
    return rest;
  }

  /** `phase` is the only store of the polling phase (migration 017); `type` is the reservation. */
  async updateConstituency(id: string, patch: any, userId?: string) {
    const constituency = await this.prisma.constituencies.findUnique({ where: { id } });
    if (!constituency) throw new ConstituencyNotFoundException(id);
    const updated = await this.prisma.constituencies.update({
      where: { id },
      data: {
        district_id: patch.district_id,
        region_id: patch.region_id,
        const_no: patch.const_no,
        phase: patch.phase,
        type: patch.type,
        metadata: patch.metadata
          ? { ...(constituency.metadata as any || {}), ...ConstituenciesService.withoutPhase(patch.metadata) }
          : undefined,
      }
    });
    await this.auditUpdate(constituency, updated, id, userId);
    return updated;
  }

  async updateMetadata(id: string, patch: any, userId?: string) {
    const constituency = await this.prisma.constituencies.findUnique({ where: { id } });
    if (!constituency) throw new ConstituencyNotFoundException(id);
    const updated = await this.prisma.constituencies.update({
      where: { id },
      data: { metadata: { ...(constituency.metadata as any || {}), ...ConstituenciesService.withoutPhase(patch) } }
    });
    await this.auditUpdate(constituency, updated, id, userId);
    return updated;
  }

  /**
   * Seat history from results, newest first: the seats of every election of the same type with the same state
   * and `const_no` (the columns, so any id format works) and the same
   * delimitation (migration 019). Independent of constituency_analysis. A seat with no state or no delimitation
   * returns only itself. Volatility counts party changes between
   * consecutive elections that have a winner.
   */
  async history(id: string) {
    const seat = await this.prisma.constituencies.findUnique({
      where: { id },
      select: { id: true, state_id: true, const_no: true, elections: { select: { type: true, delimitation: true } } },
    });
    if (!seat) throw new ConstituencyNotFoundException(id);
    // Same seat number only means the same place within one delimitation; no state or delimitation: only itself.
    const { delimitation } = seat.elections;
    const matches = await this.prisma.constituencies.findMany({
      where: seat.state_id === null || !delimitation
        ? { id }
        : { state_id: seat.state_id, const_no: seat.const_no, elections: { type: seat.elections.type, delimitation } },
      select: {
        id: true,
        election_id: true,
        voter_turnout: true,
        elections: { select: { year: true, type: true } },
        results: {
          where: { status: { in: ['WON', 'LEADING'] } },
          select: { status: true, margin: true, candidates: { select: { name: true, party_id: true } } },
        },
      },
    });
    const rows = matches
      .map((m) => {
        const win = m.results.find((r) => r.status === 'WON') ?? m.results.find((r) => r.status === 'LEADING');
        return {
          election_id: m.election_id,
          year: m.elections.year,
          type: m.elections.type,
          winner: win?.candidates.name ?? null,
          party_id: win?.candidates.party_id ?? null,
          margin: win?.margin ?? null,
          turnout: m.voter_turnout === null ? null : Number(m.voter_turnout),
          is_current: m.id === id,
        };
      })
      .sort((a, b) => b.year - a.year);
    const parties = rows.filter((r) => r.party_id !== null).map((r) => r.party_id);
    const changes = parties.filter((p, i) => i > 0 && p !== parties[i - 1]).length;
    return { volatility: { elections: parties.length, changes }, rows };
  }

  /** One CONSTITUENCY_UPDATE audit row per seat whose tags changed, written after the commit. */
  async bulkTag(ids: string[], addTags?: string[], removeTags?: string[], userId?: string) {
    const constituencies = await this.prisma.constituencies.findMany({ where: { id: { in: ids } } });
    const updates = constituencies.map(c => {
      const meta = (c.metadata as any) || {};
      let tags: string[] = meta.tags || [];
      if (addTags?.length) tags = [...new Set([...tags, ...addTags])];
      if (removeTags?.length) tags = tags.filter(t => !removeTags.includes(t));
      return this.prisma.constituencies.update({
        where: { id: c.id },
        data: { metadata: { ...meta, tags } }
      });
    });
    // Batch inside a transaction to avoid N parallel connections
    const updated = await this.prisma.$transaction(updates);
    const before = new Map(constituencies.map((c) => [c.id, c]));
    const entries: RecordAuditEntry[] = [];
    for (const after of updated) {
      const diff = changedFields(before.get(after.id) as any, after as any);
      if (diff) entries.push({ userId, action: 'CONSTITUENCY_UPDATE', entityType: 'constituency', entityId: after.id, ...diff });
    }
    await this.audit.recordMany(entries);
    return updated;
  }

  async getAnalysis(electionId: string) {
    return this.prisma.constituency_analysis.findMany({
      where: { election_id: electionId },
      include: { constituencies: true },
    });
  }

  async upsertAnalysis(constId: string, electionId: string, data: any) {
    return this.prisma.constituency_analysis.upsert({
      where: { const_id_election_id: { const_id: constId, election_id: electionId } },
      update: { ...data, updated_at: new Date() },
      create: { const_id: constId, election_id: electionId, ...data }
    });
  }

  async updateAnalysis(id: string, data: UpdateAnalysisDto) {
    const existing = await this.prisma.constituency_analysis.findUnique({ where: { id } });
    if (!existing) throw new AnalysisNotFoundException(id);
    const { incumbency, ...rest } = data;
    const updated = await this.prisma.constituency_analysis.update({
      where: { id },
      data: {
        ...rest,
        ...(incumbency !== undefined && { incumbency: incumbency as Prisma.InputJsonValue }),
        updated_at: new Date(),
      }
    });
    await this.cache.del(`election:${existing.election_id}:public-analysis`);
    return updated;
  }

  async getPublicAnalysis(electionId: string) {
    return this.cache.getOrSet(`election:${electionId}:public-analysis`, CACHE_TTL.PUBLIC_ANALYSIS, () =>
      this.prisma.constituency_analysis.findMany({
        where: { election_id: electionId },
        select: { id: true, const_id: true, election_id: true, dominance: true, dominance_party: true, incumbency: true }
      }),
    );
  }

  async getConstituencyAnalysisDetail(electionId: string, constId: string) {
    return this.prisma.constituency_analysis.findUnique({
      where: { const_id_election_id: { const_id: constId, election_id: electionId } },
    });
  }
}
