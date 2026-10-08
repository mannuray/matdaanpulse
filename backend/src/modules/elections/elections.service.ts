import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, election_status, election_type } from '@prisma/client';
import { ElectionNotFoundException } from '../../common/exceptions';
import type { CreateElectionDto, UpdateElectionDto } from './dto/election-input.dto';
import { comparableElectionIds } from '../../common/comparable-elections';
import { parseManifest } from '../../common/manifest';

@Injectable()
export class ElectionsService {
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
    const draft = await this.comparableManifest(election, parseManifest(election.manifest_url));
    return { election_id: id, manifest_url: election.manifest_url, draft };
  }

  /**
   * The public manifest with `history` (and its parallel `history_years`) and `compare_with` limited to
   * comparable elections (comparableElectionIds), so the dashboard's history layers never join another
   * delimitation's seat numbers. The stored manifest is unchanged.
   */
  async comparableManifest(
    election: { id: string; type: string; state_id: number | null; delimitation: string | null },
    manifest: Record<string, unknown> | null,
  ): Promise<Record<string, unknown> | null> {
    if (!manifest) return manifest;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null);
    const history = ids(manifest.history), compare = ids(manifest.compare_with);
    if (!history && !compare) return manifest;
    const keep = new Set(await comparableElectionIds(this.prisma, election, [...(history ?? []), ...(compare ?? [])]));
    const out: Record<string, unknown> = { ...manifest };
    if (history) {
      const years = Array.isArray(manifest.history_years) ? manifest.history_years : null;
      const kept = history.map((h, i) => ({ h, y: years?.[i] })).filter(x => keep.has(x.h));
      out.history = kept.map(x => x.h);
      if (years) out.history_years = kept.map(x => x.y);
    }
    if (compare) out.compare_with = compare.filter(c => keep.has(c));
    return out;
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
}
