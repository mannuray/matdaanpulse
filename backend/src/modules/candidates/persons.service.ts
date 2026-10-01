import { paginated } from '../../common/paginated';
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonNotFoundException } from '../../common/exceptions';
import { AuditLogService } from '../audit-log/audit-log.service';
import { changedFields } from '../audit-log/audit-diff';

/** Editable person fields accepted from the admin API (see UpdatePersonDto). */
export interface PersonInput {
  name?: string;
  photo_url?: string | null;
  gender?: string | null;
  education?: string | null;
  date_of_birth?: string | null;
  state_id?: number | null;
  region_id?: number | null;
  district_id?: number | null;
  metadata?: Record<string, unknown>;
  bio?: string | null;
  wikipedia_url?: string | null;
}

/** Normalise a name for matching: case/whitespace/punctuation/honorific-insensitive. */
export function normalizePersonName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\b(DR|SHRI|SMT|KUM|ADV|PROF|MR|MRS|MS)\b\.?/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Map DTO fields onto real columns. `bio` and `wikipedia_url` have no column
   * and are stored in metadata; date strings become Date objects.
   */
  private toPersonData(data: PersonInput, existingMetadata?: unknown) {
    const { bio, wikipedia_url, metadata, date_of_birth, ...columns } = data;
    const meta: Record<string, unknown> = {
      ...((existingMetadata as Record<string, unknown>) || {}),
      ...(metadata || {}),
    };
    if (bio !== undefined) meta.bio = bio;
    if (wikipedia_url !== undefined) meta.wikipedia_url = wikipedia_url;
    const touchesMeta = metadata !== undefined || bio !== undefined || wikipedia_url !== undefined;
    return {
      ...columns,
      ...(date_of_birth !== undefined && { date_of_birth: date_of_birth ? new Date(date_of_birth) : null }),
      ...(touchesMeta && { metadata: meta as Prisma.InputJsonValue }),
    };
  }

  async create(data: PersonInput & { name: string }) {
    return this.prisma.persons.create({
      data: this.toPersonData(data) as Prisma.personsUncheckedCreateInput,
    });
  }

  async update(id: string, data: PersonInput, userId?: string) {
    const person = await this.prisma.persons.findUnique({ where: { id } });
    if (!person) throw new PersonNotFoundException(id);
    const updated = await this.prisma.persons.update({
      where: { id },
      data: this.toPersonData(data, person.metadata) as Prisma.personsUncheckedUpdateInput,
    });
    // bio / wikipedia_url live in metadata, so they show up as metadata.bio etc.
    const diff = changedFields(person, updated);
    if (diff) await this.audit.record({ userId, action: 'PERSON_UPDATE', entityType: 'person', entityId: id, ...diff });
    return updated;
  }

  async findOne(id: string) {
    const person = await this.prisma.persons.findUnique({
      where: { id },
      include: {
        states: true,
        districts: true,
      },
    });
    if (!person) throw new PersonNotFoundException(id);
    return person;
  }

  async findWithCandidates(id: string) {
    const person = await this.prisma.persons.findUnique({
      where: { id },
      include: {
        states: true,
        districts: true,
        candidates: {
          include: {
            parties: true,
            constituencies: true,
            elections: true,
            results: true,
          },
          orderBy: {
            election_id: 'desc',
          },
        },
      },
    });

    if (!person) throw new PersonNotFoundException(id);

    const candidates = person.candidates.map((c) => {
      const r = c.results[0]; // Assuming 1:1 candidate to result mapping
      return {
        id: c.id,
        name: c.name,
        party_id: c.party_id,
        party_name: c.parties?.name || null,
        party_color: c.parties?.color || null,
        election_name: c.elections?.name || null,
        election_year: c.elections?.year || null,
        election_id: c.election_id,
        constituency_name: c.constituencies?.name || null,
        const_id: c.const_id,
        votes: r?.votes ?? 0,
        status: r?.status || null,
        margin: r?.margin ?? 0,
        is_incumbent: c.is_incumbent,
      };
    });

    return {
      ...person,
      state: person.states,
      district: person.districts,
      candidates
    };
  }

  async findAll(page = 1, limit = 100, q?: string, filters?: { state_id?: number; region_id?: number }) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    if (filters?.state_id) where.state_id = filters.state_id;
    if (filters?.region_id) where.region_id = filters.region_id;

    const [total, data] = await Promise.all([
      this.prisma.persons.count({ where }),
      this.prisma.persons.findMany({
        where,
        include: {
          states: { select: { name: true } },
          regions: { select: { name: true } },
          _count: { select: { candidates: true } },
          candidates: {
            include: { elections: { select: { name: true } } },
            distinct: ['election_id']
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const formatted = data.map((p: any) => ({
      ...p,
      state_name: p.states?.name || null,
      region_name: p.regions?.name || null,
      candidate_count: p._count?.candidates || 0,
      elections: p.candidates.map((c: any) => c.elections?.name).filter(Boolean),
    }));

    return paginated(formatted, { page, limit, total });
  }

  async search(q: string) {
    return this.prisma.persons.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: 50,
    });
  }

  /** The audit row (PERSON_MERGE) is on the target: the source row is deleted. */
  async merge(sourceId: string, targetId: string, userId?: string) {
    if (sourceId === targetId) throw new BadRequestException('source_id and target_id must differ');
    const [source, target] = await Promise.all([
      this.prisma.persons.findUnique({ where: { id: sourceId } }),
      this.prisma.persons.findUnique({ where: { id: targetId } }),
    ]);
    if (!source) throw new PersonNotFoundException(sourceId);
    if (!target) throw new PersonNotFoundException(targetId);

    // Re-point candidates, delete the source and audit atomically.
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.candidates.updateMany({
        where: { person_id: sourceId },
        data: { person_id: targetId },
      });
      await tx.persons.delete({ where: { id: sourceId } });
      await this.audit.record(
        {
          userId, action: 'PERSON_MERGE', entityType: 'person', entityId: targetId,
          oldValue: { source_id: sourceId, source_name: source.name },
          newValue: { target_id: targetId, candidates_moved: moved.count },
        },
        tx,
      );
    });
    return { merged: true, target_id: targetId };
  }

  /**
   * Link candidate rows that represent the same politician across elections.
   *
   * Heuristic (deliberately conservative — false merges are worse than misses):
   *  - Candidates are grouped by normalised name + state + normalised
   *    constituency name. Constituency ids are election-specific, but
   *    constituency names are stable across elections of the same state.
   *  - A group is skipped if it has two candidates in the same election
   *    (namesakes contesting the same seat are common and ambiguous).
   *  - If the group already contains exactly one linked person, unlinked
   *    members are attached to that person; if it has several different
   *    persons it is skipped.
   *  - Otherwise a new person is created only when ≥2 unlinked candidates from
   *    different elections match.
   */
  async autoLink() {
    const candidates = await this.prisma.candidates.findMany({
      where: { NOT: { name: 'NOTA' } },
      select: {
        id: true, name: true, election_id: true, person_id: true,
        constituencies: { select: { name: true, state_id: true } },
      },
    });

    const groups = new Map<string, typeof candidates>();
    for (const c of candidates) {
      const stateId = c.constituencies?.state_id;
      const constName = c.constituencies?.name;
      if (!stateId || !constName) continue;
      const key = `${normalizePersonName(c.name)}|${stateId}|${normalizePersonName(constName)}`;
      const arr = groups.get(key) || [];
      arr.push(c);
      groups.set(key, arr);
    }

    let linked = 0;
    let personsCreated = 0;

    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const elections = new Set(members.map((m) => m.election_id));
      if (elections.size !== members.length) continue; // same-election namesakes → ambiguous

      const unlinked = members.filter((m) => !m.person_id);
      if (unlinked.length === 0) continue;
      const personIds = new Set(members.map((m) => m.person_id).filter((id): id is string => !!id));
      if (personIds.size > 1) continue;

      if (personIds.size === 1) {
        const [personId] = personIds;
        await this.prisma.candidates.updateMany({
          where: { id: { in: unlinked.map((m) => m.id) }, person_id: null },
          data: { person_id: personId },
        });
        linked += unlinked.length;
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const person = await tx.persons.create({
          data: { name: unlinked[0].name.trim(), state_id: unlinked[0].constituencies.state_id },
        });
        await tx.candidates.updateMany({
          where: { id: { in: unlinked.map((m) => m.id) }, person_id: null },
          data: { person_id: person.id },
        });
      });
      linked += unlinked.length;
      personsCreated++;
    }

    return { persons_created: personsCreated, candidates_linked: linked };
  }
}
