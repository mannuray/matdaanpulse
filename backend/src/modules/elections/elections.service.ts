import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElectionNotFoundException } from '../../common/exceptions';

@Injectable()
export class ElectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: { type?: any; status?: any; state_id?: number; year?: number }) {
    return this.prisma.elections.findMany({
      where: {
        type: filters.type,
        status: filters.status,
        state_id: filters.state_id,
        year: filters.year,
      },
      include: {
        states: true,
      },
      orderBy: {
        year: 'desc',
      },
      take: 100,
    });
  }

  async findOne(id: string) {
    const election = await this.prisma.elections.findUnique({
      where: { id },
      include: { states: true },
    });
    if (!election) throw new ElectionNotFoundException(id);
    return election;
  }

  async getManifest(id: string) {
    const election = await this.findOne(id);
    let draft = null;
    if (election.manifest_url) {
      try { draft = JSON.parse(election.manifest_url); } catch { /* ignore */ }
    }
    return { election_id: id, manifest_url: election.manifest_url, draft };
  }

  async create(data: any) {
    return this.prisma.elections.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return this.prisma.elections.update({
      where: { id },
      data,
    });
  }

  async finalize(id: string) {
    return this.prisma.elections.update({
      where: { id },
      data: { status: 'Finalized' },
    });
  }
}
