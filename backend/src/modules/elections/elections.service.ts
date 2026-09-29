import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ElectionNotFoundException } from '../../common/exceptions';
import type { CreateElectionDto, UpdateElectionDto } from '../admin/dto/admin-input.dto';

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

  private toElectionData<T extends { tentative_next_date?: string | null }>(data: T) {
    const { tentative_next_date, ...rest } = data;
    return {
      ...rest,
      ...(tentative_next_date !== undefined && {
        tentative_next_date: tentative_next_date ? new Date(tentative_next_date) : null,
      }),
    };
  }

  async create(data: CreateElectionDto) {
    return this.prisma.elections.create({
      data: this.toElectionData(data) as Prisma.electionsUncheckedCreateInput,
    });
  }

  async update(id: string, data: UpdateElectionDto) {
    await this.findOne(id);
    return this.prisma.elections.update({
      where: { id },
      data: this.toElectionData(data) as Prisma.electionsUncheckedUpdateInput,
    });
  }

  async finalize(id: string) {
    await this.findOne(id);
    return this.prisma.elections.update({
      where: { id },
      data: { status: 'Finalized' },
    });
  }
}
