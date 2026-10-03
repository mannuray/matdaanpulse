import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SeatsBody, TallyBody } from './dto/ingest.dto';

const body = (over: Record<string, unknown> = {}) => plainToInstance(SeatsBody, {
  shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T09:41:05+05:30',
  seats: [{ const_id: 'S1', state: 'counting', round: { current: 1, total: 20 }, votes: { a: 1 } }], ...over,
});

describe('SeatsBody', () => {
  it('accepts a valid body', async () => expect(await validate(body())).toEqual([]));
  it('rejects an unknown state, an empty or oversized batch, a bad shard name, a non-ISO time', async () => {
    expect((await validate(body({ seats: [{ const_id: 'S1', state: 'won', votes: {} }] }))).length).toBeGreaterThan(0);
    expect((await validate(body({ seats: [] }))).length).toBeGreaterThan(0);
    expect((await validate(body({ seats: Array.from({ length: 501 }, () => ({ const_id: 'S', state: 'counting', votes: {} })) }))).length).toBeGreaterThan(0);
    expect((await validate(body({ shard: 'Bad Name' }))).length).toBeGreaterThan(0);
    expect((await validate(body({ observed_at: 'yesterday' }))).length).toBeGreaterThan(0);
  });
});
describe('round and tally bounds', () => {
  it('a round past the INT column is a 400', async () => {
    expect(await validate(body({ seats: [{ const_id: 'S1', state: 'counting', round: { current: 1, total: 2_147_483_647 }, votes: {} }] }))).toEqual([]);
    expect((await validate(body({ seats: [{ const_id: 'S1', state: 'counting', round: { current: 1, total: 2_147_483_648 }, votes: {} }] }))).length).toBeGreaterThan(0);
  });
  it('tally scope is shard or election, optional', async () => {
    const t = (over: Record<string, unknown>) => validate(plainToInstance(TallyBody, { shard: 'rest', source: 's', holder: 'h', observed_at: '2027-02-27T04:00:00Z', parties: [], ...over }));
    expect(await t({})).toEqual([]);
    expect(await t({ scope: 'election' })).toEqual([]);
    expect((await t({ scope: 'state' })).length).toBeGreaterThan(0);
  });
});
