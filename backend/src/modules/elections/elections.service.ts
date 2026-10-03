import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, election_status, election_type } from '@prisma/client';
import { ElectionNotFinalizedException, ElectionNotFoundException } from '../../common/exceptions';
import type { CreateElectionDto, UpdateElectionDto } from './dto/election-input.dto';
import { comparableElectionIds } from '../../common/comparable-elections';

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
    const draft = await this.comparableManifest(election, this.parseManifest(election.manifest_url));
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

  /** A late correction after Finalize (spec §6): SUPER_ADMIN only, audited; Live again until re-finalized. */
  async reopen(id: string, userId: string | null) {
    const election = await this.findOne(id);
    if (election.status !== 'Finalized') throw new ElectionNotFinalizedException(id);
    const updated = await this.prisma.elections.update({ where: { id }, data: { status: 'Live' } });
    await this.prisma.audit_logs.create({ data: { user_id: userId, action: 'ELECTION_REOPEN', entity_type: 'election', entity_id: id } });
    return updated;
  }
}
