import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonNotFoundException } from '../../common/exceptions';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.persons.create({
      data,
    });
  }

  async update(id: string, data: any) {
    const person = await this.prisma.persons.findUnique({ where: { id } });
    if (!person) throw new PersonNotFoundException(id);
    return this.prisma.persons.update({
      where: { id },
      data,
    });
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

    const enriched = person.candidates.map((c) => {
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
      candidates: enriched
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

    return { data: formatted, total, page, limit };
  }

  async search(q: string) {
    return this.prisma.persons.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: 50,
    });
  }

  async merge(sourceId: string, targetId: string) {
    await this.prisma.candidates.updateMany({
      where: { person_id: sourceId },
      data: { person_id: targetId },
    });
    await this.prisma.persons.delete({ where: { id: sourceId } });
    return { merged: true, target_id: targetId };
  }

  async autoLink() {
    // Note: Complex grouping queries like autoLink might still need raw SQL if Prisma doesn't support them well
    // For now, I'll stick to Prisma's findMany and process in memory for safety
    const candidates = await this.prisma.candidates.findMany({
      where: { person_id: null },
      select: { id: true, name: true, const_id: true, election_id: true }
    });

    const groups = new Map<string, string[]>();
    for (const c of candidates) {
      const key = `${c.name.trim().toUpperCase()}:${c.const_id}`;
      const arr = groups.get(key) || [];
      arr.push(c.id);
      groups.set(key, arr);
    }

    let linked = 0;
    let personsCreated = 0;

    for (const [key, ids] of groups.entries()) {
      if (ids.length > 1) {
        const name = key.split(':')[0];
        const person = await this.prisma.persons.create({ data: { name } });
        await this.prisma.candidates.updateMany({
          where: { id: { in: ids } },
          data: { person_id: person.id }
        });
        linked += ids.length;
        personsCreated++;
      }
    }

    return { persons_created: personsCreated, candidates_linked: linked };
  }
}
