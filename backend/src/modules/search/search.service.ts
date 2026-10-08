import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const LIMIT = 50;
/** pg_trgm word_similarity a name needs to count as a misspelling of the query (tuned on seeded names). */
export const FUZZY_MIN = 0.4;
/** Shorter queries match by substring only: trigram similarity on 2–3 letters is noise. */
export const FUZZY_MIN_QUERY = 4;

/** Escape LIKE wildcards so a query is matched literally (`%` and `_` in user input match themselves). */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Ids matching `q` by name, best first: names starting with it, then containing it, then similar spellings
 * (pg_trgm word_similarity ≥ FUZZY_MIN, migration 028), closest first.
 */
function rankedIds(table: 'constituencies' | 'candidates', q: string, filters: Prisma.Sql[]): Prisma.Sql {
  const contains = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;
  const fuzzy = q.length >= FUZZY_MIN_QUERY ? Prisma.sql`OR word_similarity(${q}, name) >= ${FUZZY_MIN}` : Prisma.empty;
  const where = Prisma.join([Prisma.sql`(name ILIKE ${contains} ${fuzzy})`, ...filters], ' AND ');
  return Prisma.sql`
    SELECT id FROM ${Prisma.raw(table)} WHERE ${where}
    ORDER BY (name ILIKE ${prefix}) DESC, (name ILIKE ${contains}) DESC, word_similarity(${q}, name) DESC, name ASC
    LIMIT ${LIMIT}`;
}

/** Rows in the order of `ids`. */
function inOrder<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => !!r);
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchConstituencies(q?: string, election_id?: string, district_id?: number) {
    const include = { districts: { select: { id: true, name: true } } } as const;
    const query = q?.trim();
    if (!query) {
      return this.prisma.constituencies.findMany({
        where: { election_id, district_id },
        include,
        orderBy: { name: 'asc' },
        take: LIMIT,
      });
    }
    const filters: Prisma.Sql[] = [];
    if (election_id) filters.push(Prisma.sql`election_id = ${election_id}::uuid`);
    if (district_id) filters.push(Prisma.sql`district_id = ${district_id}`);
    const ids = (await this.prisma.$queryRaw<{ id: string }[]>(rankedIds('constituencies', query, filters))).map((r) => r.id);
    if (ids.length === 0) return [];
    return inOrder(ids, await this.prisma.constituencies.findMany({ where: { id: { in: ids } }, include }));
  }

  async searchCandidates(q?: string, election_id?: string) {
    const include = { parties: true } as const;
    const query = q?.trim();
    if (!query) {
      return this.prisma.candidates.findMany({ where: { election_id }, include, orderBy: { name: 'asc' }, take: LIMIT });
    }
    const filters: Prisma.Sql[] = [];
    if (election_id) filters.push(Prisma.sql`election_id = ${election_id}::uuid`);
    const ids = (await this.prisma.$queryRaw<{ id: string }[]>(rankedIds('candidates', query, filters))).map((r) => r.id);
    if (ids.length === 0) return [];
    return inOrder(ids, await this.prisma.candidates.findMany({ where: { id: { in: ids } }, include }));
  }
}
