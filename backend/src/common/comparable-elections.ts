import type { PrismaService } from '../modules/prisma/prisma.service';

export interface ComparableElection { id: string; type: string; state_id: number | null; delimitation: string | null }

/**
 * The ids among `ids` (order kept, `election` itself dropped) whose election has the same type, state and
 * delimitation as `election`. Seats are linked across elections by state + seat number, which only holds within
 * one delimitation (migration 019); a NULL delimitation compares with nothing.
 */
export async function comparableElectionIds(prisma: PrismaService, election: ComparableElection, ids: string[]): Promise<string[]> {
  if (!election.delimitation || ids.length === 0) return [];
  const ok = await prisma.elections.findMany({
    where: { id: { in: ids }, type: election.type as never, state_id: election.state_id, delimitation: election.delimitation },
    select: { id: true },
  });
  const keep = new Set(ok.map(e => e.id));
  return ids.filter(i => i !== election.id && keep.has(i));
}
