import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, election_status, election_type } from '@prisma/client';
import { ElectionNotFoundException } from '../../common/exceptions';
import type { CreateElectionDto, UpdateElectionDto } from './dto/election-input.dto';

@Injectable()
export class ElectionsService {
  private readonly logger = new Logger(ElectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: { type?: election_type; status?: election_status; state_id?: number; year?: number }) {
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
    const draft = this.parseManifest(election.manifest_url);
    return { election_id: id, manifest_url: election.manifest_url, draft };
  }

  /**
   * The single place `elections.manifest_url` (JSON text in a column that is misnamed
   * "url") is parsed. Returns the manifest object (arrays and scalars are not manifests), or null when absent or not valid
   * JSON (logged, never thrown, so one bad row cannot break a page).
   */
  parseManifest(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined || raw === '') return null;
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        this.logger.warn('manifest_url is not valid JSON; treating the manifest as absent');
        return null;
      }
    }
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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
