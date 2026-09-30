import { paginated } from '../../common/paginated';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartyNotFoundException } from '../../common/exceptions';
import type { CreatePartyDto, UpdatePartyDto } from '../admin/dto/admin-input.dto';

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findPaginated(page = 1, limit = 25, q?: string, electionId?: string, stateId?: number) {
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

  async create(data: CreatePartyDto) {
    return this.prisma.parties.create({
      data,
    });
  }

  async update(id: string, data: UpdatePartyDto) {
    const party = await this.prisma.parties.findUnique({ where: { id } });
    if (!party) throw new PartyNotFoundException(id);
    return this.prisma.parties.update({
      where: { id },
      data,
    });
  }
}
