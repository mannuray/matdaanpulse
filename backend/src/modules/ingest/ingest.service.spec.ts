import { IngestService } from './ingest.service';
import { IngestBadRequestException, IngestInactiveSourceException, IngestNoLeaseException, IngestNotLiveException } from '../../common/exceptions';

const NOW = new Date('2027-02-27T04:12:00Z');
const roster = [
  { id: 'a', const_id: 'S1', party_id: 'BJP' }, { id: 'b', const_id: 'S1', party_id: 'INC' }, { id: 'n', const_id: 'S1', party_id: 'NOTA' },
  { id: 'c', const_id: 'S2', party_id: 'BJP' }, { id: 'd', const_id: 'S2', party_id: 'INC' },
];

function make(over: { status?: string; source?: string | null; lease?: boolean; seatIds?: string[] } = {}) {
  const prisma: any = {
    elections: { findUnique: jest.fn(async () => ({ status: over.status ?? 'Live' })) },
    election_ingest: { findUnique: jest.fn(async () => (over.source === null ? null : { active_source: over.source ?? 'eci-web' })) },
    candidates: { findMany: jest.fn(async ({ where }) => roster.filter(r => where.const_id.in.includes(r.const_id))) },
    seat_ingest_state: { findMany: jest.fn(async () => []) },
    results: { findMany: jest.fn(async () => []) },
    seat_holds: { findMany: jest.fn(async () => []) },
    ingest_log: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
    $executeRaw: jest.fn(async () => 1),
  };
  const shards: any = { get: jest.fn(async (_e: string, name: string) => ({ name, source_override: null, seat_ids: over.seatIds ?? ['S1', 'S2'] })) };
  const leases: any = { holds: jest.fn(async () => over.lease ?? true), current: jest.fn(async () => ({ holder: 'other', key: 'k9', expires: NOW })) };
  const notifier: any = { afterCommit: jest.fn(async () => undefined) };
  return { svc: new IngestService(prisma, shards, leases, notifier), prisma, notifier };
}
const body = (seats: any[], over: Record<string, unknown> = {}) => ({ shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T09:41:05+05:30', seats, ...over }) as any;
const s1 = { const_id: 'S1', state: 'counting', round: { current: 3, total: 20 }, votes: { a: 50, b: 40, n: 5 } };

describe('IngestService.ingestSeats — request checks', () => {
  it('refuses a non-Live election, an inactive source, a missing lease, a future observed_at', async () => {
    await expect(make({ status: 'Finalized' }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestNotLiveException);
    await expect(make({ source: 'news' }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestInactiveSourceException);
    await expect(make({ source: null }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestInactiveSourceException);
    await expect(make({ lease: false }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestNoLeaseException);
    await expect(make().svc.ingestSeats('e', { id: 'k' }, body([s1], { observed_at: '2027-02-27T04:15:00Z' }), NOW)).rejects.toBeInstanceOf(IngestBadRequestException);
  });

  it('a dry run skips Live/source/lease checks and writes nothing but the log', async () => {
    const { svc, prisma, notifier } = make({ status: 'Upcoming', source: 'other', lease: false });
    const out = await svc.ingestSeats('e', { id: 'k' }, body([s1], { dry_run: true }), NOW);
    expect(out.counts.applied).toBe(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.ingest_log.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dry_run: true }) }));
    expect(notifier.afterCommit).not.toHaveBeenCalled();
  });
});

describe('IngestService.ingestSeats — per seat', () => {
  it('one bad seat never blocks the others; a seat outside the shard or repeated is rejected', async () => {
    const { svc, notifier } = make({ seatIds: ['S1', 'S2'] });
    const out = await svc.ingestSeats('e', { id: 'k' }, body([
      s1,
      { const_id: 'S2', state: 'counting', votes: { c: 1 } },        // missing d
      { const_id: 'S9', state: 'counting', votes: {} },              // not in shard
      { ...s1 },                                                      // repeated
    ]), NOW);
    expect(out.counts).toEqual({ applied: 1, unchanged: 0, stale: 0, held: 0, rejected: 3 });
    expect(out.seats.map(s => [s.const_id, s.outcome, s.reason])).toEqual([
      ['S1', 'applied', undefined], ['S2', 'rejected', 'roster_mismatch'], ['S9', 'rejected', 'not_in_shard'], ['S1', 'rejected', 'duplicate_seat'],
    ]);
    expect(notifier.afterCommit).toHaveBeenCalledWith('e', [{ const_id: 'S1', p: 'BJP', m: 10, s: 'LEADING', r: 3, cr: 3, tr: 20 }], { kind: 'batch' });
  });
});
