import { paginated } from '../../common/paginated';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonNotFoundException } from '../../common/exceptions';
import { AuditLogService } from '../audit-log/audit-log.service';
import { changedFields } from '../audit-log/audit-diff';
import { bigintToNumber } from '../../common/util/json-safe';

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
  bio?: string | null;
  wikipedia_url?: string | null;
  caste?: string | null;
  religion?: string | null;
}

/** Persons list filter on the number of candidacies (GET /admin/persons?contests=). */
export type ContestsFilter = '0' | '1' | '2plus';

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Map DTO fields onto columns; date strings become Date objects. */
  private toPersonData(data: PersonInput) {
    const { date_of_birth, ...columns } = data;
    return {
      ...columns,
      ...(date_of_birth !== undefined && { date_of_birth: date_of_birth ? new Date(date_of_birth) : null }),
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
      data: this.toPersonData(data) as Prisma.personsUncheckedUpdateInput,
    });
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

    // Seat totals for the vote share of each contest (one grouped query).
    const constIds = [...new Set(person.candidates.map(c => c.const_id))];
    const totals = constIds.length
      ? await this.prisma.results.groupBy({ by: ['const_id'], where: { const_id: { in: constIds } }, _sum: { votes: true } })
      : [];
    const totalByConst = new Map(totals.map(t => [t.const_id, t._sum.votes ?? 0]));

    const candidates = person.candidates.map((c) => {
      const r = c.results[0]; // Assuming 1:1 candidate to result mapping
      return {
        // Type and status drive the admin history (short election name; "Lost" only once Finalized).
        election_type: c.elections?.type || null,
        election_status: c.elections?.status || null,
        const_no: c.constituencies?.const_no ?? null,
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
        age: c.age,
        assets: bigintToNumber(c.assets),
        liabilities: bigintToNumber(c.liabilities),
        criminal_cases: c.criminal_cases,
        vote_share: r && (totalByConst.get(c.const_id) ?? 0) > 0
          ? Math.round((r.votes / totalByConst.get(c.const_id)!) * 1000) / 10
          : null,
        party_abbreviation: c.parties?.abbreviation ?? null,
        party_symbol_url: c.parties?.symbol_url ?? null,
        party_eci_symbol_url: c.parties?.eci_symbol_url ?? null,
      };
    });

    // Newest first. The query orders by election id (a UUID), which says nothing about time.
    candidates.sort((a, b) => (b.election_year ?? 0) - (a.election_year ?? 0));

    const credit = person.photo_url ? await this.prisma.image_credits.findUnique({ where: { url: person.photo_url } }) : null;

    return {
      ...person,
      state: person.states,
      district: person.districts,
      photo_credit: credit ? { source_url: credit.source_url, author: credit.author, licence: credit.licence } : null,
      candidates
    };
  }

  /**
   * The admin persons list. `contests` filters on the number of candidacies (none, 1, or 2 and more): Prisma
   * cannot filter on a relation count, so that page of ids and the total come from SQL (the other filters
   * applied there too) and the rows are then loaded by id, in the same name order.
   */
  async findAll(
    page = 1, limit = 100, q?: string,
    filters?: { state_id?: number; region_id?: number; contests?: ContestsFilter },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.personsWhereInput = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (filters?.state_id) where.state_id = filters.state_id;
    if (filters?.region_id) where.region_id = filters.region_id;

    const include = {
      states: { select: { name: true } },
      regions: { select: { name: true } },
      _count: { select: { candidates: true } },
      // Only what the list shows: full candidate rows carry BigInt affidavit columns.
      candidates: { select: { election_id: true, elections: { select: { name: true } } }, distinct: ['election_id'] },
    } satisfies Prisma.personsInclude;

    let total: number;
    let data: Prisma.personsGetPayload<{ include: typeof include }>[];
    if (filters?.contests) {
      const conds: Prisma.Sql[] = [
        filters.contests === '2plus'
          ? Prisma.sql`(SELECT COUNT(*) FROM candidates c WHERE c.person_id = p.id) >= 2`
          : Prisma.sql`(SELECT COUNT(*) FROM candidates c WHERE c.person_id = p.id) = ${Prisma.raw(filters.contests === '0' ? '0' : '1')}`,
      ];
      if (q) conds.push(Prisma.sql`p.name ILIKE ${`%${q.replace(/[\\%_]/g, '\\$&')}%`}`);
      if (filters.state_id) conds.push(Prisma.sql`p.state_id = ${filters.state_id}`);
      if (filters.region_id) conds.push(Prisma.sql`p.region_id = ${filters.region_id}`);
      const cond = Prisma.join(conds, ' AND ');
      const [[{ count }], idRows] = await Promise.all([
        this.prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM persons p WHERE ${cond}`,
        this.prisma.$queryRaw<{ id: string }[]>`SELECT p.id FROM persons p WHERE ${cond} ORDER BY p.name ASC, p.id ASC LIMIT ${limit} OFFSET ${skip}`,
      ]);
      total = count;
      const ids = idRows.map((r) => r.id);
      const rows = ids.length ? await this.prisma.persons.findMany({ where: { id: { in: ids } }, include }) : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      data = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => !!r);
    } else {
      [total, data] = await Promise.all([
        this.prisma.persons.count({ where }),
        this.prisma.persons.findMany({ where, include, orderBy: { name: 'asc' }, skip, take: limit }),
      ]);
    }

    const formatted = data.map((p) => ({
      ...p,
      state_name: p.states?.name || null,
      region_name: p.regions?.name || null,
      candidate_count: p._count?.candidates || 0,
      elections: p.candidates.map((c) => c.elections?.name).filter(Boolean),
    }));

    return paginated(formatted, { page, limit, total });
  }

  async search(q: string) {
    return this.prisma.persons.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: 50,
    });
  }
}
