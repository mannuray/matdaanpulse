import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreditRow { url: string; source_url: string; author: string | null; licence: string; used_by: string | null }

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every hosted image's credit, with the person or party that shows it (About page). */
  async list(): Promise<CreditRow[]> {
    const credits = await this.prisma.image_credits.findMany({ select: { url: true, source_url: true, author: true, licence: true } });
    const urls = credits.map(c => c.url);
    const [persons, parties] = await Promise.all([
      this.prisma.persons.findMany({ where: { photo_url: { in: urls } }, select: { photo_url: true, name: true } }),
      this.prisma.parties.findMany({ where: { OR: [{ symbol_url: { in: urls } }, { eci_symbol_url: { in: urls } }] }, select: { symbol_url: true, eci_symbol_url: true, name: true } }),
    ]);
    const owner = new Map<string, string>();
    for (const p of parties) { if (p.symbol_url) owner.set(p.symbol_url, p.name); if (p.eci_symbol_url) owner.set(p.eci_symbol_url, p.name); }
    for (const p of persons) if (p.photo_url) owner.set(p.photo_url, p.name);
    return credits
      .map(c => ({ ...c, used_by: owner.get(c.url) ?? null }))
      .sort((a, b) => (a.used_by ?? '').localeCompare(b.used_by ?? '') || a.url.localeCompare(b.url));
  }
}
