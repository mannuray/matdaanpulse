import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const states = await this.prisma.states.findMany({
      include: {
        _count: {
          select: { elections: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return states.map(s => ({
      ...s,
      election_count: s._count.elections
    }));
  }

  async findDistricts(stateId: number) {
    return this.prisma.districts.findMany({
      where: { state_id: stateId },
      orderBy: { name: 'asc' }
    });
  }

  async findRegions(stateId: number) {
    return this.prisma.regions.findMany({
      where: { state_id: stateId },
      orderBy: { name: 'asc' }
    });
  }
}
