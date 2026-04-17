import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConstituencyNotFoundException } from '../../common/exceptions';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll() {
    return this.prisma.results.findMany({ take: 100 });
  }

  async getElectionSummary(id: string) {
    const cacheKey = `election:${id}:summary`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const partyResults = await this.prisma.$queryRaw`
      SELECT 
        c.party_id, 
        p.name as party_name, 
        p.color, 
        COUNT(*) FILTER (WHERE r.status = 'WON')::int as "won",
        COUNT(*) FILTER (WHERE r.status = 'LEADING')::int as "leading"
      FROM results r
      JOIN candidates c ON r.candidate_id = c.id
      JOIN parties p ON c.party_id = p.id
      WHERE r.election_id = ${id}::uuid
        AND r.status IN ('WON', 'LEADING')
      GROUP BY c.party_id, p.name, p.color
      ORDER BY (COUNT(*) FILTER (WHERE r.status = 'WON') + COUNT(*) FILTER (WHERE r.status = 'LEADING')) DESC
    `;

    await this.redis.set(cacheKey, JSON.stringify(partyResults), 300); // 5 min cache
    return partyResults;
  }

  async getVoteShare(id: string) {
    const cacheKey = `election:${id}:vote-share`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const partyVotes: any[] = await this.prisma.$queryRaw`
      SELECT 
        c.party_id, 
        p.name as party_name, 
        p.color, 
        SUM(r.votes)::bigint as total_votes
      FROM results r
      JOIN candidates c ON r.candidate_id = c.id
      JOIN parties p ON c.party_id = p.id
      WHERE r.election_id = ${id}::uuid
      GROUP BY c.party_id, p.name, p.color
      ORDER BY total_votes DESC
    `;

    const grandTotal = partyVotes.reduce((sum, r) => sum + Number(r.total_votes), 0);
    
    const results = partyVotes.map(p => ({
      ...p,
      total_votes: Number(p.total_votes),
      percentage: grandTotal > 0 ? parseFloat(((Number(p.total_votes) / grandTotal) * 100).toFixed(2)) : 0
    }));

    await this.redis.set(cacheKey, JSON.stringify(results), 300);
    return results;
  }

  async getResults(id: string) {
    const cacheKey = `election:${id}:full-results`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.prisma.results.findMany({
      where: { election_id: id },
      select: {
        const_id: true,
        votes: true,
        status: true,
        margin: true,
        candidates: {
          select: {
            party_id: true,
            name: true,
          }
        },
        constituencies: {
          select: { type: true }
        }
      },
      orderBy: { const_id: 'asc' }
    });

    const results = data.map(r => ({
      const_id: r.const_id,
      party_id: r.candidates.party_id,
      candidate_name: r.candidates.name,
      votes: r.votes,
      status: r.status,
      margin: r.margin,
      const_type: r.constituencies.type,
    }));

    await this.redis.set(cacheKey, JSON.stringify(results), 300);
    return results;
  }

  async getDistrictResults(electionId: string, districtId: number) {
    const data = await this.prisma.results.findMany({
      where: {
        election_id: electionId,
        constituencies: { district_id: districtId }
      },
      include: {
        candidates: {
          include: { parties: true }
        },
        constituencies: true
      },
      orderBy: {
        constituencies: { const_no: 'asc' }
      }
    });

    return data.map(r => ({
      const_id: r.const_id,
      const_name: r.constituencies.name,
      candidate_name: r.candidates.name,
      party_id: r.candidates.party_id,
      party_name: r.candidates.parties?.name || 'Independent',
      color: r.candidates.parties?.color || '#6b7280',
      votes: r.votes,
      status: r.status,
      margin: r.margin,
    }));
  }

  async getConstituencyDetail(electionId: string, constId: string) {
    const constituency = await this.prisma.constituencies.findFirst({
      where: { id: constId, election_id: electionId },
      include: {
        districts: true,
        states: true,
        candidates: {
          include: {
            parties: true,
            persons: {
              select: { id: true, photo_url: true }
            },
            results: {
              where: { const_id: constId }
            }
          }
        }
      }
    });

    if (!constituency) throw new ConstituencyNotFoundException(constId);

    const candidateResults = constituency.candidates
      .map(c => {
        const r = c.results[0];
        return {
          id: c.id,
          name: c.name,
          party: c.parties,
          is_incumbent: c.is_incumbent,
          votes: r?.votes || 0,
          status: r?.status || null,
          margin: r?.margin || 0,
          person_id: c.person_id,
          person: c.persons,
        };
      })
      .sort((a, b) => b.votes - a.votes);

    return {
      ...constituency,
      district: constituency.districts,
      state: constituency.states,
      candidates: candidateResults
    };
  }

  async getLiveResults(id: string) {
    const constituencies = await this.prisma.constituencies.findMany({
      where: { election_id: id },
      select: {
        id: true,
        name: true,
        const_no: true,
        type: true,
        results: {
          select: {
            id: true,
            candidate_id: true,
            votes: true,
            status: true,
            margin: true,
            last_updated: true,
            candidates: {
              select: {
                name: true,
                party_id: true,
                parties: {
                  select: {
                    name: true,
                    color: true,
                    abbreviation: true
                  }
                }
              }
            }
          },
          orderBy: { votes: 'desc' }
        }
      },
      orderBy: { const_no: 'asc' }
    });

    return constituencies.map(co => ({
      const_id: co.id,
      const_name: co.name,
      const_no: co.const_no,
      const_type: co.type,
      candidates: co.results.map(r => ({
        result_id: r.id,
        candidate_id: r.candidate_id,
        candidate_name: r.candidates.name,
        party_id: r.candidates.party_id,
        party_name: r.candidates.parties?.name || 'Independent',
        party_color: r.candidates.parties?.color || '#6b7280',
        party_abbr: r.candidates.parties?.abbreviation,
        votes: r.votes,
        status: r.status,
        margin: r.margin || 0,
        last_updated: r.last_updated,
      }))
    }));
  }

  async compareConstituencies(id1: string, id2: string) {
    const [r1, r2] = await Promise.all([
      this.prisma.results.findMany({
        where: { const_id: id1 },
        include: { candidates: { include: { parties: true } } }
      }),
      this.prisma.results.findMany({
        where: { const_id: id2 },
        include: { candidates: { include: { parties: true } } }
      })
    ]);

    return {
      constituency_1: { const_id: id1, results: r1 },
      constituency_2: { const_id: id2, results: r2 }
    };
  }

  async purgeElectionCache(electionId: string) {
    await this.redis.delByPattern(`election:${electionId}:*`);
  }
}
