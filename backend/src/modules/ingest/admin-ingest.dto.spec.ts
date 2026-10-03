import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeedSettingsBody, IngestKeyBody, ShardBody } from './dto/admin-ingest.dto';

describe('admin ingest DTOs', () => {
  it('feed: a source name or null, hold minutes 1–240', async () => {
    expect(await validate(plainToInstance(FeedSettingsBody, { active_source: 'eci-web', hold_minutes: 10 }))).toEqual([]);
    expect(await validate(plainToInstance(FeedSettingsBody, { active_source: null, hold_minutes: 10 }))).toEqual([]);
    expect((await validate(plainToInstance(FeedSettingsBody, { active_source: 'ECI Web', hold_minutes: 0 }))).length).toBe(2);
  });
  it('shard selector lists must be integers', async () => {
    expect((await validate(plainToInstance(ShardBody, { selector: { state_ids: ['x'] }, source_override: null }))).length).toBeGreaterThan(0);
  });
  it('const_no_ranges must be [a, b] integer pairs with 1 <= a <= b', async () => {
    const ok = (r: unknown) => validate(plainToInstance(ShardBody, { selector: { const_no_ranges: r }, source_override: null }));
    expect(await ok([[1, 10], [5, 5]])).toEqual([]);
    expect((await ok([[5, 1]])).length).toBeGreaterThan(0);
    expect((await ok([[1]])).length).toBeGreaterThan(0);
    expect((await ok([[0, 3]])).length).toBeGreaterThan(0);
    expect((await ok([[1, 2.5]])).length).toBeGreaterThan(0);
    expect((await ok([[1, 2, 3]])).length).toBeGreaterThan(0);
    expect((await ok('x')).length).toBeGreaterThan(0);
  });
  it('key names', async () => {
    expect(await validate(plainToInstance(IngestKeyBody, { name: 'worker-sg-1' }))).toEqual([]);
    expect((await validate(plainToInstance(IngestKeyBody, { name: 'x' }))).length).toBe(1);
  });
});
