import 'reflect-metadata';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { BulkOverridePayload } from './result-override.dto';

// Same options as the global pipe in main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (body: unknown) => pipe.transform(body, { type: 'body', metatype: BulkOverridePayload });

const ELECTION = '11111111-1111-4111-8111-111111111111';
const RESULT = '22222222-2222-4222-8222-222222222222';

/** Payload exactly as scraper/src/simulation/replay.ts sends it. */
const replayPayload = () => ({
  election_id: ELECTION,
  overrides: [
    { result_id: RESULT, const_id: 'S04_1_VALMIKI', party_id: 'BJP', votes: 1200, status: 'LEADING', margin: 300, round_no: 3 },
  ],
  rounds: {
    S04_1_VALMIKI: { current_round: 3, total_rounds: 18 },
    S04_2_PASCHIM: { current_round: 2, total_rounds: 20 },
  },
});

describe('BulkOverridePayload validation', () => {
  it('accepts the replay payload including rounds keyed by const_id', async () => {
    const out: BulkOverridePayload = await run(replayPayload());
    expect(out.rounds).toBeInstanceOf(Map);
    expect(out.rounds!.get('S04_1_VALMIKI')).toMatchObject({ current_round: 3, total_rounds: 18 });
    expect(out.overrides[0].const_id).toBe('S04_1_VALMIKI');
  });

  it('accepts a payload without rounds or client const_id/party_id', async () => {
    const out = await run({
      election_id: ELECTION,
      overrides: [{ result_id: RESULT, votes: 1, status: 'WON', margin: 0 }],
    });
    expect(out.rounds).toBeUndefined();
  });

  it('validates each rounds value', async () => {
    const body = replayPayload();
    (body.rounds as any).S04_1_VALMIKI.total_rounds = 0; // Min(1)
    await expect(run(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown properties inside a rounds value', async () => {
    const body = replayPayload();
    (body.rounds as any).S04_1_VALMIKI.bogus = true;
    await expect(run(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects rounds that is not an object', async () => {
    await expect(run({ ...replayPayload(), rounds: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid override status', async () => {
    const body = replayPayload();
    body.overrides[0].status = 'MAYBE';
    await expect(run(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('BulkOverridePayload election ids', () => {
  it('accepts seeded non-RFC election ids (Bihar 2025)', async () => {
    const { ValidationPipe } = await import('@nestjs/common');
    const { BulkOverridePayload } = await import('./result-override.dto');
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(
      pipe.transform(
        { election_id: 'c3d4e5f6-a7b8-9012-cdef-234567890abc', overrides: [{ result_id: 'b2c3d4e5-f6a7-4901-bcde-f12345678901', votes: 1, status: 'LEADING', margin: 0 }] },
        { type: 'body', metatype: BulkOverridePayload },
      ),
    ).resolves.toBeDefined();
  });
});
