import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { earlierComparableElectionIds } from '../../common/comparable-elections';
import type { AllianceIn, AnalysisInput, ElectionIn, HeavyweightIn, HeavyweightReason, SeatIn, VoteSplitIn } from '../../common/seat-analysis';
import { ElectionNotFoundException } from '../../common/exceptions';

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** What the analysis reads from a manifest (`elections.manifest_url` holds JSON text). Bad / missing JSON = empty. */
export function manifestBits(raw: string | null) {
  let m: Json = {};
  try { const v = raw ? JSON.parse(raw) : {}; if (v && typeof v === 'object' && !Array.isArray(v)) m = v; } catch { /* empty */ }
  const alliances: AllianceIn[] = arr(m.alliances).map(a => ({ id: String(a.id ?? ''), parties: Array.isArray(a.parties) ? a.parties.map(String) : [] })).filter(a => a.id);
  const g = m.government as Json | undefined;
  const government = g && Array.isArray(g.parties) && g.parties.length ? g.parties.map(String) : null;
  const voteSplits: VoteSplitIn[] = arr(m.vote_splits).filter(v => str(v.spoiler) && str(v.hurts))
    .map(v => ({ spoiler: String(v.spoiler), hurts: String(v.hurts), ...(str(v.label) ? { label: String(v.label) } : {}) }));
  const hw = (list: unknown, reason: HeavyweightReason): HeavyweightIn[] =>
    arr(list).filter(x => str(x.name)).map(x => ({ person_id: str(x.person_id), name: String(x.name), party_id: str(x.party_id), reason }));
  return { alliances, government, voteSplits, heavyweights: [...hw(m.leaders, 'leader'), ...hw(m.cabinet, 'cabinet')] };
}

interface RoleRow { party_id: string; role: string; person_id: string | null; person_name: string; from_date: Date | null; to_date: Date | null }
/** Party unit roles held on `date` (YYYY-MM-DD) as heavyweights. */
export function rolesAt(roles: RoleRow[], date: string): HeavyweightIn[] {
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return roles
    .filter(r => (day(r.from_date) ?? '0000') <= date && (day(r.to_date) ?? '9999') >= date)
    .map(r => ({ person_id: r.person_id, name: r.person_name, party_id: r.party_id, reason: r.role as HeavyweightReason }));
}

@Injectable()
export class SeatAnalysisLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(electionId: string): Promise<AnalysisInput> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const historyIds = (await earlierComparableElectionIds(this.prisma, election)).reverse(); // oldest → newest
    const prevAny = await this.prisma.elections.findFirst({
      where: { type: election.type, state_id: election.state_id, year: { lt: election.year } }, orderBy: { year: 'desc' }, select: { id: true },
    });
    const ids = [...new Set([...historyIds, electionId, ...(prevAny ? [prevAny.id] : [])])];
    const built = new Map((await Promise.all(ids.map(id => this.election(id)))).map(e => [e.id, e]));
    const bits = manifestBits(election.manifest_url);
    const current = built.get(electionId)!;
    const roles = election.state_id == null ? [] : await this.prisma.party_unit_roles.findMany({ where: { state_id: election.state_id } });
    const lineage = (await this.prisma.party_lineage.findMany()).map(r => ({
      party_id: r.party_id, predecessor_id: r.predecessor_id, kind: r.kind, effective_date: r.effective_date.toISOString().slice(0, 10),
      state_id: r.state_id, is_successor: r.is_successor,
    }));
    return {
      stateId: election.state_id,
      current,
      voteSplits: bits.voteSplits,
      heavyweights: [...bits.heavyweights, ...rolesAt(roles, current.date)],
      history: historyIds.map(id => built.get(id)!),
      previousAny: prevAny ? built.get(prevAny.id)! : null,
      lineage,
    };
  }

  private async election(id: string): Promise<ElectionIn> {
    const e = await this.prisma.elections.findUniqueOrThrow({ where: { id }, select: { id: true, year: true, tentative_next_date: true, manifest_url: true } });
    const consts = await this.prisma.constituencies.findMany({
      where: { election_id: id }, select: { id: true, const_no: true, type: true, region_id: true, voter_turnout: true, total_electors: true },
    });
    // Candidates with their result if any: an Upcoming election has candidates before results rows exist (its baseline).
    const cands = await this.prisma.candidates.findMany({
      where: { election_id: id },
      select: { const_id: true, person_id: true, name: true, party_id: true, results: { select: { votes: true, status: true }, take: 1 } },
    });
    const byConst = new Map<string, SeatIn['candidates']>();
    for (const c of cands) {
      const r = c.results[0];
      const list = byConst.get(c.const_id) ?? [];
      list.push({ person_id: c.person_id, name: c.name, party_id: c.party_id, votes: r?.votes ?? 0, status: r ? String(r.status) : 'PENDING' });
      byConst.set(c.const_id, list);
    }
    const bits = manifestBits(e.manifest_url);
    return {
      id: e.id, year: e.year, date: e.tentative_next_date ? e.tentative_next_date.toISOString().slice(0, 10) : `${e.year}-07-01`,
      seats: consts.map(c => ({
        const_id: c.id, const_no: c.const_no, reserved: String(c.type) as SeatIn['reserved'], region_id: c.region_id,
        turnout: c.voter_turnout == null ? null : Number(c.voter_turnout), electors: c.total_electors ?? null, candidates: byConst.get(c.id) ?? [],
      })),
      alliances: bits.alliances, government: bits.government,
    };
  }
}
