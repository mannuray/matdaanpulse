import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateNotFoundException, PersonNotFoundException } from '../../common/exceptions';

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters?: { election_id?: string; const_id?: string }, take = 1000) {
    return this.prisma.candidates.findMany({
      where: {
        election_id: filters?.election_id,
        const_id: filters?.const_id,
      },
      take,
      select: {
        id: true,
        name: true,
        party_id: true,
        const_id: true,
        is_incumbent: true,
        parties: {
          select: {
            id: true,
            name: true,
            color: true,
            abbreviation: true
          }
        },
        constituencies: {
          select: {
            id: true,
            name: true,
          }
        },
        persons: {
          select: {
            id: true,
            name: true,
            photo_url: true
          }
        }
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidates.findUnique({
      where: { id },
      include: {
        parties: true,
        constituencies: true,
        persons: true,
        elections: true,
      },
    });
    if (!candidate) throw new CandidateNotFoundException(id);
    return candidate;
  }

  findByName(name: string, election_id?: string, limit = 20) {
    return this.prisma.candidates.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        election_id: election_id,
      },
      include: {
        parties: true,
        constituencies: true,
        persons: true,
      },
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(data: any) {
    return this.prisma.candidates.create({
      data,
    });
  }

  async update(id: string, data: any) {
    const candidate = await this.prisma.candidates.findUnique({ where: { id } });
    if (!candidate) throw new CandidateNotFoundException(id);
    return this.prisma.candidates.update({
      where: { id },
      data,
    });
  }

  async linkPerson(candidateId: string, personId: string) {
    const candidate = await this.prisma.candidates.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new CandidateNotFoundException(candidateId);
    const person = await this.prisma.persons.findUnique({ where: { id: personId } });
    if (!person) throw new PersonNotFoundException(personId);

    const m = (candidate.metadata || {}) as any;
    
    // Update person with metadata if null
    await this.prisma.persons.update({
      where: { id: personId },
      data: {
        photo_url: person.photo_url || m.photo_url || undefined,
        gender: person.gender || m.gender || undefined,
        education: person.education || m.education || undefined,
      }
    });

    return this.prisma.candidates.update({
      where: { id: candidateId },
      data: { person_id: personId },
    });
  }

  async unlinkPerson(candidateId: string) {
    const candidate = await this.prisma.candidates.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new CandidateNotFoundException(candidateId);
    return this.prisma.candidates.update({
      where: { id: candidateId },
      data: { person_id: null },
    });
  }
}
