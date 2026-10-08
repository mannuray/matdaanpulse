import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchConstituencies(q?: string, election_id?: string, district_id?: number) {
    const where: Prisma.constituenciesWhereInput = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (election_id) where.election_id = election_id;
    if (district_id) where.district_id = district_id;

    return this.prisma.constituencies.findMany({
      where,
      include: { districts: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  async searchCandidates(q?: string, election_id?: string) {
    const where: Prisma.candidatesWhereInput = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (election_id) where.election_id = election_id;

    return this.prisma.candidates.findMany({
      where,
      include: { parties: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }
}
