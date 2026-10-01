import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_TTL } from '../redis/cache.service';
import { LiveStateService } from './live-state.service';
import { ConstituencyNotFoundException } from '../../common/exceptions';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly liveState: LiveStateService,
  ) {}

  /**
   * Results-derived cache keys carry the election's live version, so any results
   * write — including direct SQL that never calls purgeElectionCache — moves
   * readers to a fresh key (the DB trigger bumps the version).
   */
  private async versionedKey(id: string, name: string): Promise<string> {
    const { version } = await this.liveState.get(id);
    return `election:${id}:${name}:v${version}`;
  }

  async getElectionSummary(id: string) {
    return this.cache.getOrSet(await this.versionedKey(id, 'summary'), CACHE_TTL.ELECTION_SUMMARY, () =>
      this.prisma.$queryRaw`
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
    `,
    );
  }

  async getVoteShare(id: string) {
    return this.cache.getOrSet(await this.versionedKey(id, 'vote-share'), CACHE_TTL.VOTE_SHARE, () => this.loadVoteShare(id));
  }

  private async loadVoteShare(id: string) {
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

    return results;
  }

  async getResults(id: string) {
    return this.cache.getOrSet(await this.versionedKey(id, 'full-results'), CACHE_TTL.FULL_RESULTS, () => this.loadResults(id));
  }

  private async loadResults(id: string) {
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

    return data.map(r => ({
      const_id: r.const_id,
      party_id: r.candidates.party_id,
      candidate_name: r.candidates.name,
      votes: r.votes,
      status: r.status,
      margin: r.margin,
      const_type: r.constituencies.type,
    }));
  }

  /**
   * Snapshot for a live version: results rows plus the seat tally and vote share
   * computed from the same rows, so every tile updates from one consistent read.
   *
   * The version and the rows are read in one REPEATABLE READ transaction, so a
   * snapshot labelled V holds exactly version V's data. It is cached (single-
   * flight) under `election:<id>:snapshot:v<expectedVersion>` only when the
   * version read inside the transaction equals `expectedVersion`; if the version
   * has moved on (another instance's write, a stale memo), the newer snapshot is
   * returned uncached and the caller must not label it as `expectedVersion`.
   */
  async getSnapshot(id: string, expectedVersion: number): Promise<ResultsSnapshot> {
    try {
      return await this.cache.getOrSet(`election:${id}:snapshot:v${expectedVersion}`, CACHE_TTL.RESULTS_SNAPSHOT, async () => {
        const snapshot = await this.loadSnapshot(id);
        if (snapshot.version !== expectedVersion) throw new VersionMoved(snapshot);
        return snapshot;
      });
    } catch (err) {
      if (err instanceof VersionMoved) return err.snapshot;
      throw err;
    }
  }

  private loadSnapshot(id: string): Promise<ResultsSnapshot> {
    return this.prisma.$transaction(
      async (tx) => {
        const [state] = await tx.$queryRaw<{ version: bigint }[]>`
          SELECT version FROM election_live_state WHERE election_id = ${id}::uuid`;
        const rows = await tx.results.findMany({
          where: { election_id: id },
          select: {
            const_id: true,
            votes: true,
            status: true,
            margin: true,
            candidates: { select: { party_id: true, name: true, parties: { select: { name: true, color: true } } } },
            constituencies: { select: { type: true } },
          },
          orderBy: { const_id: 'asc' },
        });
        return buildSnapshot(Number(state?.version ?? 0), rows);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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
        current_round: true,
        total_rounds: true,
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
      current_round: co.current_round ?? null,
      total_rounds: co.total_rounds ?? null,
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

  async compareConstituencies(electionId: string, id1: string, id2: string) {
    const [r1, r2] = await Promise.all([
      this.prisma.results.findMany({
        where: { election_id: electionId, const_id: id1 },
        include: { candidates: { include: { parties: true } } },
        orderBy: { votes: 'desc' },
      }),
      this.prisma.results.findMany({
        where: { election_id: electionId, const_id: id2 },
        include: { candidates: { include: { parties: true } } },
        orderBy: { votes: 'desc' },
      })
    ]);

    return {
      constituency_1: { const_id: id1, results: r1 },
      constituency_2: { const_id: id2, results: r2 }
    };
  }

  /** Drop every cached view of an election. Never throws (a Redis outage is logged). */
  /**
   * Drops the election's cached derived data. The content-addressed snapshot keys
   * (`…:snapshot:v<n>`) are deliberately kept: they never change meaning, and a
   * wildcard purge right after a commit could delete the snapshot a fast reader
   * had just cached for the new version (one extra DB load per override). Old
   * snapshots fall away with their TTL.
   */
  async purgeElectionCache(electionId: string): Promise<boolean> {
    const base = `election:${electionId}`;
    const outcomes = await Promise.all([
      this.cache.delByPattern(`${base}:summary:*`),
      this.cache.delByPattern(`${base}:vote-share:*`),
      this.cache.delByPattern(`${base}:full-results:*`),
      this.cache.del(`${base}:public-analysis`),
    ]);
    return outcomes.every(Boolean);
  }
}

export interface ResultsSnapshot {
  version: number;
  /** Same rows as GET /elections/:id/results. */
  results: {
    const_id: string;
    party_id: string | null;
    candidate_name: string;
    votes: number;
    status: string;
    margin: number | null;
    const_type: string;
  }[];
  /** Same shape as GET /elections/:id/alliances. */
  summary: { party_id: string; party_name: string; color: string | null; won: number; leading: number }[];
  /** Same shape as GET /elections/:id/vote-share. */
  voteShare: { party_id: string; party_name: string; color: string | null; total_votes: number; percentage: number }[];
}

interface SnapshotSourceRow {
  const_id: string;
  votes: number;
  status: string;
  margin: number | null;
  candidates: { party_id: string | null; name: string; parties: { name: string; color: string | null } | null };
  constituencies: { type: string };
}

/** Pure: mirrors the SQL of getElectionSummary / loadVoteShare (rows without a party are left out of both). */
export function buildSnapshot(version: number, rows: SnapshotSourceRow[]): ResultsSnapshot {
  const results = rows.map((r) => ({
    const_id: r.const_id,
    party_id: r.candidates.party_id,
    candidate_name: r.candidates.name,
    votes: r.votes,
    status: r.status,
    margin: r.margin,
    const_type: r.constituencies.type,
  }));

  const byParty = new Map<string, { party_id: string; party_name: string; color: string | null; won: number; leading: number; total_votes: number }>();
  for (const r of rows) {
    const pid = r.candidates.party_id;
    const party = r.candidates.parties;
    if (!pid || !party) continue;
    let e = byParty.get(pid);
    if (!e) {
      e = { party_id: pid, party_name: party.name, color: party.color, won: 0, leading: 0, total_votes: 0 };
      byParty.set(pid, e);
    }
    if (r.status === 'WON') e.won++;
    else if (r.status === 'LEADING') e.leading++;
    e.total_votes += Number(r.votes) || 0;
  }
  const parties = [...byParty.values()];

  const summary = parties
    .filter((p) => p.won + p.leading > 0)
    .sort((a, b) => b.won + b.leading - (a.won + a.leading))
    .map(({ party_id, party_name, color, won, leading }) => ({ party_id, party_name, color, won, leading }));

  const grandTotal = parties.reduce((sum, p) => sum + p.total_votes, 0);
  const voteShare = [...parties]
    .sort((a, b) => b.total_votes - a.total_votes)
    .map(({ party_id, party_name, color, total_votes }) => ({
      party_id,
      party_name,
      color,
      total_votes,
      percentage: grandTotal > 0 ? parseFloat(((total_votes / grandTotal) * 100).toFixed(2)) : 0,
    }));

  return { version, results, summary, voteShare };
}

/** Thrown inside the snapshot loader so a snapshot of another version is never cached under the requested key. */
class VersionMoved extends Error {
  constructor(readonly snapshot: ResultsSnapshot) {
    super('live version moved');
  }
}
