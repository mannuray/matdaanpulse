import { ElectionNotFoundException } from '../../common/exceptions';
import { electionKeys } from '../redis/election-cache.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_TTL } from '../redis/cache.service';
import { LiveStateService } from './live-state.service';
import { ConstituencyNotFoundException } from '../../common/exceptions';

/** Candidate fields of a compare row (the affidavit's BigInt columns are not JSON-serialisable). */
const COMPARE_CANDIDATE = {
  id: true, name: true, party_id: true, const_id: true, election_id: true, person_id: true, is_incumbent: true, parties: true,
} as const;

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly liveState: LiveStateService,
  ) {}

  /**
   * Results-derived cache keys carry the election's live version, so any results
   * write — including direct SQL that never purges the cache — moves
   * readers to a fresh key (the DB trigger bumps the version).
   */
  private async versionedKey(id: string, name: string): Promise<string> {
    const { version } = await this.liveState.get(id);
    return electionKeys.versioned(id, name, version);
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

  /** Per region: seats and each party's votes and seats won or leading (the Regions tab). 404 for an unknown election. */
  async getRegionShares(id: string) {
    if (!(await this.prisma.elections.findUnique({ where: { id }, select: { id: true } }))) throw new ElectionNotFoundException(id);
    return this.cache.getOrSet(await this.versionedKey(id, 'region-shares-v2'), CACHE_TTL.VOTE_SHARE, () => this.loadRegionShares(id));
  }

  private async loadRegionShares(id: string) {
    const rows: { region_id: number; region_name: string; seats: bigint; const_ids: string[]; party_id: string; votes: bigint; won: bigint }[] = await this.prisma.$queryRaw`
      SELECT g.id AS region_id, g.name AS region_name,
             (SELECT count(*) FROM constituencies k2 WHERE k2.election_id = ${id}::uuid AND k2.region_id = g.id)::bigint AS seats,
             (SELECT array_agg(k3.id ORDER BY k3.const_no) FROM constituencies k3 WHERE k3.election_id = ${id}::uuid AND k3.region_id = g.id) AS const_ids,
             c.party_id, SUM(r.votes)::bigint AS votes, COUNT(*) FILTER (WHERE r.status IN ('WON', 'LEADING'))::bigint AS won
      FROM results r
      JOIN candidates c ON c.id = r.candidate_id
      JOIN constituencies k ON k.id = r.const_id
      JOIN regions g ON g.id = k.region_id
      WHERE r.election_id = ${id}::uuid
      GROUP BY g.id, g.name, c.party_id
      ORDER BY g.name, votes DESC`;
    const byRegion = new Map<number, { id: number; name: string; seats: number; const_ids: string[]; parties: { party_id: string; votes: number; won: number }[] }>();
    for (const r of rows) {
      const g = byRegion.get(r.region_id) ?? { id: r.region_id, name: r.region_name, seats: Number(r.seats), const_ids: r.const_ids ?? [], parties: [] };
      g.parties.push({ party_id: r.party_id, votes: Number(r.votes), won: Number(r.won) });
      byRegion.set(r.region_id, g);
    }
    return { regions: [...byRegion.values()] };
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
      return await this.cache.getOrSet(electionKeys.snapshot(id, expectedVersion), CACHE_TTL.RESULTS_SNAPSHOT, async () => {
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
            candidates: { select: { party_id: true, name: true, person_id: true, parties: { select: { name: true, color: true } } } },
            constituencies: { select: { type: true } },
          },
          orderBy: { const_id: 'asc' },
        });
        const seatStates = await tx.seat_ingest_state.findMany({ where: { election_id: id, state: { not: null } }, select: { const_id: true, state: true, round_current: true, round_total: true } });
        // Same RepeatableRead transaction as the version and results: a snapshot never pairs version N with another trail.
        const trails = await loadTrails(tx, id);
        // A row without a state only records a rejection (migration 021); viewers never see it.
        return buildSnapshot(Number(state?.version ?? 0), rows, seatStates as { const_id: string; state: string; round_current: number | null; round_total: number | null }[], trails);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** A seat's counting timeline (migration 025), oldest first: round, leader party, margin, votes counted. */
  async getSeatRounds(electionId: string, constId: string) {
    return this.prisma.$queryRaw<{ seq: number; r: number | null; rt: number | null; lp: string | null; m: number | null; v: number; declared: boolean; at: Date }[]>`
      SELECT s.seq, s.round_no AS r, s.round_total AS rt, c.party_id AS lp, s.margin AS m, s.votes_counted AS v, s.declared, s.observed_at AS at
      FROM seat_rounds s LEFT JOIN candidates c ON c.id = s.leader_candidate_id
      WHERE s.election_id = ${electionId}::uuid AND s.const_id = ${constId} ORDER BY s.seq`;
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
        regions: { select: { id: true, name: true } },
        candidates: {
          include: {
            parties: { select: { id: true, name: true, abbreviation: true, color: true, symbol_url: true, eci_symbol_url: true } },
            persons: { select: { id: true, photo_url: true, wikipedia_url: true } },
            results: { where: { const_id: constId } },
          },
        },
      },
    });

    if (!constituency) throw new ConstituencyNotFoundException(constId);

    let lastUpdated: Date | null = null;
    const candidateResults = constituency.candidates
      .map(c => {
        const r = c.results[0];
        if (r?.last_updated && (!lastUpdated || r.last_updated > lastUpdated)) lastUpdated = r.last_updated;
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
          age: c.age,
          assets: c.assets,
          liabilities: c.liabilities,
          criminal_cases: c.criminal_cases,
        };
      })
      .sort((a, b) => b.votes - a.votes);

    return {
      ...constituency,
      // Prisma Decimal is a class instance: class-transformer would try to rebuild it (DecimalError), so send a number.
      voter_turnout: constituency.voter_turnout == null ? null : Number(constituency.voter_turnout),
      district: constituency.districts,
      state: constituency.states,
      region: constituency.regions,
      last_updated: lastUpdated,
      candidates: candidateResults,
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

    const seatStates = await this.prisma.seat_ingest_state.findMany({ where: { election_id: id, state: { not: null } }, select: { const_id: true, state: true } });
    const stateOf = new Map(seatStates.map(s => [s.const_id, s.state as string]));

    return constituencies.map(co => ({
      const_id: co.id,
      const_name: co.name,
      const_no: co.const_no,
      const_type: co.type,
      current_round: co.current_round ?? null,
      total_rounds: co.total_rounds ?? null,
      seat_state: stateOf.get(co.id) ?? null,
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

  // compareConstituencies selects candidate columns explicitly: a full row carries the BigInt affidavit columns.
  async compareConstituencies(electionId: string, id1: string, id2: string) {
    const [r1, r2] = await Promise.all([
      this.prisma.results.findMany({
        where: { election_id: electionId, const_id: id1 },
        include: { candidates: { select: COMPARE_CANDIDATE } },
        orderBy: { votes: 'desc' },
      }),
      this.prisma.results.findMany({
        where: { election_id: electionId, const_id: id2 },
        include: { candidates: { select: COMPARE_CANDIDATE } },
        orderBy: { votes: 'desc' },
      })
    ]);

    return {
      constituency_1: { const_id: id1, results: r1 },
      constituency_2: { const_id: id2, results: r2 }
    };
  }

  /** Drop every cached view of an election. Never throws (a Redis outage is logged). */

}

/** A seat's counting trail in a snapshot: points oldest → newest (round, leader party, margin, votes counted). */
export interface SeatTrailDto {
  points: { r: number | null; lp: string | null; m: number | null; v: number }[];
  /** Lead changes over the whole timeline. */
  lc: number;
  /** Largest margin over the whole timeline. */
  pk: number | null;
  /** The current leader's deepest deficit over the whole timeline, as a share of votes counted then (comeback); null if never behind. */
  md: number | null;
}

/** Every seat's counting trail for an election (call inside the snapshot's transaction): last ≤6 points + whole-timeline lc, pk, md. */
export function loadTrails(tx: Pick<PrismaService, '$queryRaw'>, electionId: string): Promise<({ const_id: string } & SeatTrailDto)[]> {
  return tx.$queryRaw<({ const_id: string } & SeatTrailDto)[]>`
    SELECT t.const_id,
           json_agg(json_build_object('r', t.round_no, 'lp', c.party_id, 'm', t.margin, 'v', t.votes_counted) ORDER BY t.seq) FILTER (WHERE t.rn <= 6) AS points,
           (count(*) FILTER (WHERE t.changed))::int AS lc,
           max(t.margin) AS pk,
           max(t.margin::float8 / NULLIF(t.votes_counted, 0)) FILTER (WHERE t.leader_candidate_id IS DISTINCT FROM t.current_leader) AS md
    FROM (
      SELECT s.*, row_number() OVER (PARTITION BY s.const_id ORDER BY s.seq DESC) AS rn,
             first_value(s.leader_candidate_id) OVER (PARTITION BY s.const_id ORDER BY s.seq DESC) AS current_leader,
             (lag(s.leader_candidate_id) OVER (PARTITION BY s.const_id ORDER BY s.seq) IS NOT NULL
              AND lag(s.leader_candidate_id) OVER (PARTITION BY s.const_id ORDER BY s.seq) IS DISTINCT FROM s.leader_candidate_id) AS changed
      FROM seat_rounds s WHERE s.election_id = ${electionId}::uuid
    ) t LEFT JOIN candidates c ON c.id = t.leader_candidate_id
    GROUP BY t.const_id`;
}

export interface ResultsSnapshot {
  version: number;
  /** Same rows as GET /elections/:id/results. */
  results: {
    const_id: string;
    party_id: string | null;
    candidate_name: string;
    /** The candidate's person (the live analysis matches sitting MLAs and heavyweights by it). */
    person_id: string | null;
    votes: number;
    status: string;
    margin: number | null;
    const_type: string;
  }[];
  /** Same shape as GET /elections/:id/alliances. */
  summary: { party_id: string; party_name: string; color: string | null; won: number; leading: number }[];
  /** Same shape as GET /elections/:id/vote-share. */
  voteShare: { party_id: string; party_name: string; color: string | null; total_votes: number; percentage: number }[];
  /** Per-seat ingest state and counting rounds; only seats that have ingest state. */
  seats: Record<string, { state: string; cr: number | null; tr: number | null }>;
  /** Per-seat counting trail (migration 025): the last ≤6 timeline points, lead changes, peak margin; only seats with timeline rows. */
  trail: Record<string, SeatTrailDto>;
}

interface SnapshotSourceRow {
  const_id: string;
  votes: number;
  status: string;
  margin: number | null;
  candidates: { party_id: string | null; name: string; person_id?: string | null; parties: { name: string; color: string | null } | null };
  constituencies: { type: string };
}

/** Pure: mirrors the SQL of getElectionSummary / loadVoteShare (rows without a party are left out of both). */
export function buildSnapshot(
  version: number,
  rows: SnapshotSourceRow[],
  seatStates: { const_id: string; state: string; round_current: number | null; round_total: number | null }[] = [],
  trails: ({ const_id: string } & SeatTrailDto)[] = [],
): ResultsSnapshot {
  const results = rows.map((r) => ({
    const_id: r.const_id,
    party_id: r.candidates.party_id,
    candidate_name: r.candidates.name,
    person_id: r.candidates.person_id ?? null,
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

  const seats = Object.fromEntries(seatStates.map((s) => [s.const_id, { state: s.state, cr: s.round_current, tr: s.round_total }]));

  const trail = Object.fromEntries(trails.map(({ const_id, ...t }) => [const_id, t]));

  return { version, results, summary, voteShare, seats, trail };
}

/** Thrown inside the snapshot loader so a snapshot of another version is never cached under the requested key. */
class VersionMoved extends Error {
  constructor(readonly snapshot: ResultsSnapshot) {
    super('live version moved');
  }
}
