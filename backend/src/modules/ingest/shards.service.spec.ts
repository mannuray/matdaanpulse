import { ShardsService, matchesSelector } from './shards.service';
import { IngestShardNotFoundException, IngestShardOverlapException } from '../../common/exceptions';

const seats = [
  { id: 'S1', state_id: 1, region_id: 10, district_id: 100, const_no: 1 },
  { id: 'S2', state_id: 1, region_id: 11, district_id: 101, const_no: 2 },
  { id: 'S3', state_id: 2, region_id: 20, district_id: 200, const_no: 3 },
];

function make(shards: any[] = []) {
  const prisma: any = {
    constituencies: { findMany: jest.fn(async () => seats) },
    ingest_shards: {
      findMany: jest.fn(async () => shards),
      upsert: jest.fn(async ({ create }) => { shards.push({ ...create, lease_holder: null, lease_key_id: null, lease_expires_at: null }); return create; }),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    election_ingest: { findUnique: jest.fn(async () => null) },
  };
  return { svc: new ShardsService(prisma), prisma };
}

describe('matchesSelector', () => {
  it('is a union of its clauses', () => {
    expect(matchesSelector(seats[0], { state_ids: [2], const_no_ranges: [[1, 1]] })).toBe(true);
    expect(matchesSelector(seats[1], { state_ids: [2], const_no_ranges: [[1, 1]] })).toBe(false);
    expect(matchesSelector(seats[2], { region_ids: [20] })).toBe(true);
    expect(matchesSelector(seats[0], {})).toBe(false);
  });
});

describe('ShardsService', () => {
  it('with no shards, rest is the whole election', async () => {
    const { svc } = make();
    expect(await svc.list('e')).toEqual([expect.objectContaining({ name: 'rest', seat_ids: ['S1', 'S2', 'S3'] })]);
  });
  it('rest is every seat in no named shard', async () => {
    const { svc } = make([{ name: 'north', selector: { state_ids: [1] }, source_override: null }]);
    const list = await svc.list('e');
    expect(list.map(s => [s.name, s.seat_ids])).toEqual([['north', ['S1', 'S2']], ['rest', ['S3']]]);
  });
  it('refuses a shard that overlaps another', async () => {
    const { svc } = make([{ name: 'north', selector: { state_ids: [1] }, source_override: null }]);
    await expect(svc.upsert('e', 'two', { selector: { const_no_ranges: [[2, 3]] }, source_override: null })).rejects.toBeInstanceOf(IngestShardOverlapException);
    await expect(svc.upsert('e', 'south', { selector: { state_ids: [2] }, source_override: null })).resolves.toMatchObject({ name: 'south', seat_ids: ['S3'] });
  });
  it('editing a shard does not overlap with itself; an unknown name is a 404', async () => {
    const { svc } = make([{ name: 'north', selector: { state_ids: [1] }, source_override: null }]);
    await expect(svc.upsert('e', 'north', { selector: { region_ids: [10] }, source_override: null })).resolves.toBeTruthy();
    await expect(svc.get('e', 'nope')).rejects.toBeInstanceOf(IngestShardNotFoundException);
  });
  it('refuses an empty selector and the reserved name', async () => {
    const { svc } = make();
    await expect(svc.upsert('e', 'x', { selector: {}, source_override: null })).rejects.toThrow(/empty/);
    await expect(svc.upsert('e', 'rest', { selector: { state_ids: [1] }, source_override: null })).rejects.toThrow(/reserved/);
  });
});
