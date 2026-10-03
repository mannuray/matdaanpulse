import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestBadRequestException, IngestShardNotFoundException, IngestShardOverlapException } from '../../common/exceptions';

export interface ShardSelector { state_ids?: number[]; region_ids?: number[]; district_ids?: number[]; const_no_ranges?: [number, number][] }
export interface ShardInfo { name: string; source_override: string | null; selector: ShardSelector | null; lease_holder: string | null; lease_key_id: string | null; lease_expires_at: Date | null; seat_ids: string[] }
type SeatKey = { id: string; state_id: number | null; region_id: number | null; district_id: number | null; const_no: number };

export const REST = 'rest';

/** Union of the selector's clauses; an empty selector matches nothing. */
export function matchesSelector(seat: Omit<SeatKey, 'id'>, sel: ShardSelector): boolean {
  return (!!seat.state_id && !!sel.state_ids?.includes(seat.state_id))
    || (!!seat.region_id && !!sel.region_ids?.includes(seat.region_id))
    || (!!seat.district_id && !!sel.district_ids?.includes(seat.district_id))
    || !!sel.const_no_ranges?.some(([a, b]) => seat.const_no >= a && seat.const_no <= b);
}
const isEmpty = (s: ShardSelector) => !s.state_ids?.length && !s.region_ids?.length && !s.district_ids?.length && !s.const_no_ranges?.length;

/** Named, non-overlapping seat sets per election; "rest" (implicit, its lease on election_ingest) is every other seat. */
@Injectable()
export class ShardsService {
  constructor(private readonly prisma: PrismaService) {}

  private seats(electionId: string): Promise<SeatKey[]> {
    return this.prisma.constituencies.findMany({ where: { election_id: electionId }, select: { id: true, state_id: true, region_id: true, district_id: true, const_no: true }, orderBy: { const_no: 'asc' } });
  }

  async list(electionId: string): Promise<ShardInfo[]> {
    const [seats, rows, ingest] = await Promise.all([
      this.seats(electionId),
      this.prisma.ingest_shards.findMany({ where: { election_id: electionId }, orderBy: { name: 'asc' } }),
      this.prisma.election_ingest.findUnique({ where: { election_id: electionId } }),
    ]);
    const taken = new Set<string>();
    const named: ShardInfo[] = rows.map((r: any) => {
      const seat_ids = seats.filter(s => matchesSelector(s, r.selector as ShardSelector)).map(s => s.id);
      seat_ids.forEach(id => taken.add(id));
      return { name: r.name, source_override: r.source_override, selector: r.selector as ShardSelector, lease_holder: r.lease_holder, lease_key_id: r.lease_key_id, lease_expires_at: r.lease_expires_at, seat_ids };
    });
    const rest: ShardInfo = {
      name: REST, source_override: ingest?.rest_source_override ?? null, selector: null,
      lease_holder: ingest?.rest_lease_holder ?? null, lease_key_id: ingest?.rest_lease_key_id ?? null, lease_expires_at: ingest?.rest_lease_expires_at ?? null,
      seat_ids: seats.filter(s => !taken.has(s.id)).map(s => s.id),
    };
    return [...named, rest];
  }

  async get(electionId: string, name: string): Promise<ShardInfo> {
    const found = (await this.list(electionId)).find(s => s.name === name);
    if (!found) throw new IngestShardNotFoundException(name);
    return found;
  }

  async upsert(electionId: string, name: string, input: { selector: ShardSelector; source_override: string | null }): Promise<ShardInfo> {
    if (name === REST) throw new IngestBadRequestException('"rest" is reserved for the seats in no shard');
    if (isEmpty(input.selector)) throw new IngestBadRequestException('A shard selector cannot be empty');
    const seats = await this.seats(electionId);
    const mine = new Set(seats.filter(s => matchesSelector(s, input.selector)).map(s => s.id));
    for (const other of await this.prisma.ingest_shards.findMany({ where: { election_id: electionId } })) {
      if (other.name === name) continue;
      const clash = seats.filter(s => mine.has(s.id) && matchesSelector(s, other.selector as ShardSelector)).map(s => s.id);
      if (clash.length) throw new IngestShardOverlapException(other.name, clash.slice(0, 5));
    }
    await this.prisma.ingest_shards.upsert({
      where: { election_id_name: { election_id: electionId, name } },
      create: { election_id: electionId, name, selector: input.selector as any, source_override: input.source_override },
      update: { selector: input.selector as any, source_override: input.source_override },
    });
    return { name, source_override: input.source_override, selector: input.selector, lease_holder: null, lease_key_id: null, lease_expires_at: null, seat_ids: [...mine] };
  }

  async remove(electionId: string, name: string): Promise<void> {
    await this.prisma.ingest_shards.deleteMany({ where: { election_id: electionId, name } });
  }
}
