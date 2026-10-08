import { paginated } from '../../common/paginated';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { changedFields, createdFields } from '../audit-log/audit-diff';
import { PartyNotFoundException } from '../../common/exceptions';
import { buildPartyRecord, stateExtras, type LoadedElection } from './party-record';
import { manifestBits } from '../constituencies/seat-analysis.loader';
import type { CreatePartyDto, UpdatePartyDto, EciRecognitionFilter } from './dto/party-input.dto';

const ymd = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');
export const toLineageEvent = (r: { party_id: string; predecessor_id: string; kind: string; effective_date: Date; state_id: number | null; is_successor: boolean; note: string | null; source_url?: string | null }) => ({
  party_id: r.party_id, predecessor_id: r.predecessor_id, kind: r.kind, effective_date: ymd(r.effective_date),
  state_id: r.state_id, is_successor: r.is_successor, note: r.note, source_url: r.source_url ?? null,
});

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Every party: the public lookup that colours and marks every result (no cap; there are ~800). */
  findAll() {
    return this.prisma.parties.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const party = await this.prisma.parties.findUnique({
      where: { id },
    });
    if (!party) throw new PartyNotFoundException(id);
    const [units, lineage] = await Promise.all([
      this.prisma.party_units.findMany({ where: { party_id: id }, include: { states: { select: { name: true } }, roles: { include: { persons: { select: { photo_url: true } } } } }, orderBy: { state_id: 'asc' } }),
      this.prisma.party_lineage.findMany({ where: { OR: [{ party_id: id }, { predecessor_id: id }] }, orderBy: [{ effective_date: 'asc' }, { id: 'asc' }] }),
    ]);
    return {
      ...party,
      units: units.map(u => ({
        state_id: u.state_id, state_name: u.states.name, eci_recognition: u.eci_recognition, office: u.office, website: u.website,
        // Current holders (no end date) first, then the most recent terms.
        roles: [...u.roles].sort((a, b) => Number(a.to_date !== null) - Number(b.to_date !== null) || ymd(b.from_date).localeCompare(ymd(a.from_date)))
          .map(r => ({ role: r.role, person_id: r.person_id, person_name: r.person_name, from_date: r.from_date ? ymd(r.from_date) : null, to_date: r.to_date ? ymd(r.to_date) : null, photo_url: r.persons?.photo_url ?? null })),
      })),
      lineage: lineage.map(toLineageEvent),
    };
  }

  /**
   * The party's record across Finalized VS elections, from stored seat analysis (party page spec §2). With `stateCode`
   * (any case) also the latest election there: its MLAs, the seat flow touching the party and its seats per region.
   */
  async record(id: string, stateCode?: string) {
    const party = await this.prisma.parties.findUnique({ where: { id }, select: { id: true } });
    if (!party) throw new PartyNotFoundException(id);
    const [els, lineageRows] = await Promise.all([
      this.prisma.elections.findMany({
        where: { type: 'VS', status: 'Finalized', state_id: { not: null } },
        select: { id: true, state_id: true, year: true, tentative_next_date: true, delimitation: true, manifest_url: true,
          states: { select: { code: true, name: true } }, election_analysis: { select: { data: true } }, _count: { select: { constituencies: true } } },
      }),
      this.prisma.party_lineage.findMany({ orderBy: [{ effective_date: 'asc' }, { id: 'asc' }] }),
    ]);
    const loaded: LoadedElection[] = els.filter(e => e.states).map(e => ({
      id: e.id, state_id: e.state_id!, state_code: e.states!.code, state_name: e.states!.name, year: e.year,
      date: e.tentative_next_date ? ymd(e.tentative_next_date) : `${e.year}-07-01`,
      delimitation: e.delimitation, seats_total: e._count.constituencies,
      government: manifestBits(e.manifest_url).government, analysis: (e.election_analysis?.data ?? null) as LoadedElection['analysis'],
    }));
    const rec = buildPartyRecord(id, loaded, lineageRows.map(toLineageEvent));
    const latest = stateCode ? rec.elections.find(e => e.state_code.toUpperCase() === stateCode.toUpperCase()) : undefined;
    if (!latest) return rec;
    const winners = await this.prisma.results.findMany({
      where: { election_id: latest.election_id, status: 'WON', candidates: { party_id: id } },
      select: { margin: true, const_id: true, constituencies: { select: { name: true } },
        candidates: { select: { name: true, person_id: true, persons: { select: { photo_url: true } } } } },
    });
    const mlas = winners.map(w => ({
      person_id: w.candidates.person_id, name: w.candidates.name, photo_url: w.candidates.persons?.photo_url ?? null,
      const_id: w.const_id, const_name: w.constituencies.name, margin: w.margin,
    })).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
    const regionIds = [...new Set((loaded.find(l => l.id === latest.election_id)?.analysis?.breakdowns?.region ?? []).map(r => Number(r.group)).filter(Number.isInteger))];
    const names = new Map((regionIds.length ? await this.prisma.regions.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } }) : [])
      .map(r => [String(r.id), r.name]));
    const extras = stateExtras(id, loaded.find(l => l.id === latest.election_id)!, g => names.get(g) ?? g);
    return { ...rec, state: { code: latest.state_code, election_id: latest.election_id, mlas, ...extras } };
  }

  /** Every lineage event (renames, mergers, splits), oldest first: the comparison rule's input on the public site. */
  async findLineage() {
    const rows = await this.prisma.party_lineage.findMany({ orderBy: [{ effective_date: 'asc' }, { id: 'asc' }] });
    return rows.map(toLineageEvent);
  }

  /** `eciRecognition`: a value, or `none` for parties with no recognition set (NULL). */
  async findPaginated(
    page = 1, limit = 25, q?: string, electionId?: string, stateId?: number, eciRecognition?: EciRecognitionFilter,
  ) {
    const skip = (page - 1) * limit;
    
    // Build the where clause
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { abbreviation: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (eciRecognition) where.eci_recognition = eciRecognition === 'none' ? null : eciRecognition;

    const filterCandidates: any = {};
    let hasCandidateFilter = false;
    if (electionId) {
      filterCandidates.election_id = electionId;
      hasCandidateFilter = true;
    }
    if (stateId) {
      filterCandidates.constituencies = { state_id: stateId };
      hasCandidateFilter = true;
    }

    if (hasCandidateFilter) {
      where.candidates = { some: filterCandidates };
    }

    const [total, parties] = await Promise.all([
      this.prisma.parties.count({ where }),
      this.prisma.parties.findMany({
        where,
        include: {
          _count: {
            select: {
              candidates: {
                where: hasCandidateFilter ? filterCandidates : {},
              },
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const data = parties.map((p: any) => ({
      ...p,
      candidate_count: p._count?.candidates || 0,
    }));

    return paginated(data, { page, limit, total });
  }

  /**
   * Where the party is used: candidates and wins (status WON) per election, newest year first, plus totals.
   * `totals.elections` counts elections with at least one candidate of the party.
   */
  async usage(id: string) {
    const party = await this.prisma.parties.findUnique({ where: { id }, select: { id: true } });
    if (!party) throw new PartyNotFoundException(id);
    const [candidates, wins] = await Promise.all([
      this.prisma.candidates.groupBy({ by: ['election_id'], where: { party_id: id }, _count: { _all: true } }),
      this.prisma.results.groupBy({
        by: ['election_id'], where: { status: 'WON', candidates: { party_id: id } }, _count: { _all: true },
      }),
    ]);
    const winsBy = new Map(wins.map((w) => [w.election_id, w._count._all]));
    const countBy = new Map(candidates.map((c) => [c.election_id, c._count._all]));
    const elections = countBy.size
      ? await this.prisma.elections.findMany({
        where: { id: { in: [...countBy.keys()] } },
        select: { id: true, name: true, type: true, year: true },
      })
      : [];
    const rows = elections
      .map((e) => ({
        election_id: e.id, name: e.name, type: e.type, year: e.year,
        candidates: countBy.get(e.id) ?? 0, wins: winsBy.get(e.id) ?? 0,
      }))
      .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    return {
      totals: {
        candidates: rows.reduce((n, r) => n + r.candidates, 0),
        elections: rows.length,
        wins: rows.reduce((n, r) => n + r.wins, 0),
      },
      elections: rows,
    };
  }

  async create(data: CreatePartyDto, userId?: string) {
    const party = await this.prisma.parties.create({
      data,
    });
    await this.audit.record({
      userId, action: 'PARTY_CREATE', entityType: 'party', entityId: party.id, newValue: createdFields(party),
    });
    return party;
  }

  async update(id: string, data: UpdatePartyDto, userId?: string) {
    const party = await this.prisma.parties.findUnique({ where: { id } });
    if (!party) throw new PartyNotFoundException(id);
    const updated = await this.prisma.parties.update({
      where: { id },
      data,
    });
    const diff = changedFields(party, updated);
    if (diff) await this.audit.record({ userId, action: 'PARTY_UPDATE', entityType: 'party', entityId: id, ...diff });
    return updated;
  }
}
