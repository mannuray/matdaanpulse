import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_TTL } from '../redis/cache.service';
import { AnalysisContext, AnalysisStrategy } from './strategies/analysis-strategy.interface';
import { Prisma } from '@prisma/client';
import { ConstituencyNotFoundException, ElectionNotFoundException, AnalysisNotFoundException } from '../../common/exceptions';
import type { UpdateAnalysisDto } from '../admin/dto/admin-input.dto';

@Injectable()
export class ConstituenciesService {
  private readonly logger = new Logger(ConstituenciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject('ANALYSIS_STRATEGIES')
    private readonly strategies: AnalysisStrategy[],
  ) {}

  async findOneWithAnalysis(id: string) {
    const constituency = await this.prisma.constituencies.findUnique({
      where: { id },
      include: { districts: true, regions: true, elections: true },
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

    return { data, total, page, limit };
  }

  async updateConstituency(id: string, patch: any) {
    const constituency = await this.prisma.constituencies.findUnique({ where: { id } });
    if (!constituency) throw new ConstituencyNotFoundException(id);
    return this.prisma.constituencies.update({
      where: { id },
      data: {
        district_id: patch.district_id,
        region_id: patch.region_id,
        const_no: patch.const_no,
        metadata: patch.metadata ? { ...(constituency.metadata as any || {}), ...patch.metadata } : undefined,
      }
    });
  }

  async updateMetadata(id: string, patch: any) {
    const constituency = await this.prisma.constituencies.findUnique({ where: { id } });
    if (!constituency) throw new ConstituencyNotFoundException(id);
    return this.prisma.constituencies.update({
      where: { id },
      data: { metadata: { ...(constituency.metadata as any || {}), ...patch } }
    });
  }

  async bulkTag(ids: string[], addTags?: string[], removeTags?: string[]) {
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
    return this.prisma.$transaction(updates);
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

  private extractConstNo(constId: string): string {
    const stripped = constId.replace(/^[A-Z]{2}_(?:VS\d*_)?/, '');
    const match = stripped.match(/^(\d+)_/);
    return match ? match[1] : stripped;
  }

  async computeAnalysis(electionId: string, historyElectionIds: string[], manifest?: any) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId } });
    if (!election) throw new ElectionNotFoundException(electionId);

    const constituencies = await this.prisma.constituencies.findMany({ where: { election_id: electionId } });
    const allElectionIds = [...historyElectionIds, electionId];

    const allElections = await this.prisma.elections.findMany({
      where: { id: { in: allElectionIds } },
      select: { id: true, year: true }
    });
    const electionYearMap = new Map(allElections.map(e => [e.id, e.year]));

    // Fetch winners for all elections
    const winners = await this.prisma.results.findMany({
      where: { election_id: { in: allElectionIds }, status: { in: ['WON', 'LEADING'] } },
      include: { candidates: true }
    });

    const winnersByElection = new Map<string, Map<string, any>>();
    for (const w of winners) {
      if (!winnersByElection.has(w.election_id)) winnersByElection.set(w.election_id, new Map());
      winnersByElection.get(w.election_id)!.set(this.extractConstNo(w.const_id), {
        party_id: w.candidates.party_id,
        candidate_name: w.candidates.name,
        margin: w.margin || 0,
      });
    }

    // Results by constituency for current election
    const currentResults = await this.prisma.results.findMany({
      where: { election_id: electionId },
      include: { candidates: true },
      orderBy: [{ const_id: 'asc' }, { votes: 'desc' }]
    });
    const resultsByConst = new Map<string, any[]>();
    for (const r of currentResults) {
      const arr = resultsByConst.get(r.const_id) || [];
      arr.push({ party_id: r.candidates.party_id, votes: r.votes || 0, status: r.status });
      resultsByConst.set(r.const_id, arr);
    }

    // Candidates by election and constituency
    const allCandidates = await this.prisma.candidates.findMany({ where: { election_id: { in: allElectionIds } } });
    const candidatesByElectionConst = new Map<string, Map<string, any[]>>();
    for (const c of allCandidates) {
      if (!candidatesByElectionConst.has(c.election_id)) candidatesByElectionConst.set(c.election_id, new Map());
      const cMap = candidatesByElectionConst.get(c.election_id)!;
      const arr = cMap.get(c.const_id) || [];
      arr.push(c);
      cMap.set(c.const_id, arr);
    }

    const analysisToCreate: any[] = [];

    for (const constituency of constituencies) {
      const context: AnalysisContext = {
        constId: constituency.id,
        constNo: this.extractConstNo(constituency.id),
        electionId,
        historyElectionIds,
        electionYearMap,
        winnersByElection,
        resultsByConst,
        candidatesByElectionConst,
        manifest,
      };

      let analysisData: any = {};
      for (const strategy of this.strategies) {
        const result = strategy.execute(context);
        analysisData = { ...analysisData, ...result };
      }

      analysisToCreate.push({
        const_id: constituency.id,
        election_id: electionId,
        dominance: analysisData.dominance,
        dominance_party: analysisData.dominance_party,
        incumbency: {
          ...analysisData.incumbency,
          swing: analysisData.swing,
          seat_type: analysisData.seat_type,
          dominance_wins: analysisData.dominance_wins,
          dominance_total: analysisData.dominance_total,
          revision: analysisData.revision,
          seat_history: analysisData.seat_history,
          spoiler: analysisData.spoiler,
        },
      });
    }

    // Perform bulk update in a transaction
    await this.prisma.$transaction([
      this.prisma.constituency_analysis.deleteMany({
        where: { election_id: electionId }
      }),
      this.prisma.constituency_analysis.createMany({
        data: analysisToCreate
      })
    ]);

    // Invalidate public analysis cache
    await this.cache.del(`election:${electionId}:public-analysis`);

    return { computed: analysisToCreate.length };
  }
}
