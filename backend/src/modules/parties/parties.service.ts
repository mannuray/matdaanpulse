import { paginated } from '../../common/paginated';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { changedFields, createdFields } from '../audit-log/audit-diff';
import { PartyNotFoundException } from '../../common/exceptions';
import type { CreatePartyDto, UpdatePartyDto, EciRecognitionFilter } from './dto/party-input.dto';

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.parties.findMany({
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async findOne(id: string) {
    const party = await this.prisma.parties.findUnique({
      where: { id },
    });
    if (!party) throw new PartyNotFoundException(id);
    return party;
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
