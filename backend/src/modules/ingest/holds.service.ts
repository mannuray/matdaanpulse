import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HoldRow { const_id: string; const_no: number; name: string; round_at_hold: number | null; expires_at: Date; created_by_name: string | null }

@Injectable()
export class HoldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(electionId: string, now = new Date()): Promise<HoldRow[]> {
    return this.prisma.$queryRaw<HoldRow[]>`
      SELECT h.const_id, c.const_no, c.name, h.round_at_hold, h.expires_at, u.name AS created_by_name
      FROM seat_holds h JOIN constituencies c ON c.id = h.const_id LEFT JOIN users u ON u.id = h.created_by
      WHERE h.election_id = ${electionId}::uuid AND h.expires_at > ${now}
      ORDER BY h.expires_at`;
  }

  async release(electionId: string, constId: string): Promise<void> {
    await this.prisma.seat_holds.deleteMany({ where: { election_id: electionId, const_id: constId } });
  }

  /** Creates or refreshes the hold; returns its expiry. */
  async upsert(tx: PrismaService, electionId: string, constId: string, roundAtHold: number | null, minutes: number, userId: string | null, now: Date): Promise<Date> {
    const expires_at = new Date(now.getTime() + minutes * 60_000);
    await tx.seat_holds.upsert({
      where: { election_id_const_id: { election_id: electionId, const_id: constId } },
      create: { election_id: electionId, const_id: constId, round_at_hold: roundAtHold, expires_at, created_by: userId },
      update: { round_at_hold: roundAtHold, expires_at, created_by: userId, created_at: now },
    });
    return expires_at;
  }
}
