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
    // Every roster candidate has a results row (zero votes) unless a test says otherwise.
    results: { findMany: jest.fn(async ({ where }) => roster.filter(r => where.const_id?.in?.includes(r.const_id)).map(r => ({ candidate_id: r.id, const_id: r.const_id, votes: 0, status: 'TRAILING', margin: 0 }))) },
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

describe('IngestService.ingestSeats — refusals are logged for the alerts', () => {
  it.each([
    [{ status: 'Finalized' }, 'not_live'], [{ source: 'news' }, 'inactive_source'], [{ lease: false }, 'no_lease'],
  ])('%o → ingest_log row refused=%s with no counts, then the 409', async (over, reason) => {
    const { svc, prisma } = make(over as any);
    await expect(svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeTruthy();
    expect(prisma.ingest_log.create).toHaveBeenCalledWith({ data: expect.objectContaining({ shard: 'rest', kind: 'seats', refused: reason }) });
    expect(prisma.ingest_log.create.mock.calls[0][0].data.counts).toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('a failing refusal log never hides the 409', async () => {
    const { svc, prisma } = make({ lease: false });
    prisma.ingest_log.create.mockRejectedValueOnce(new Error('db down'));
    const err = await svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW).catch(e => e);
    expect(err).toBeInstanceOf(IngestNoLeaseException);
    expect(JSON.stringify(err.getResponse())).not.toContain('"other"'); // the current holder is not disclosed
  });
  it('tally refusals are logged as kind tally', async () => {
    const { svc, prisma } = make({ lease: false });
    await expect(svc.tally('e', { id: 'k' }, { shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T04:00:00Z', parties: [] } as any, NOW)).rejects.toBeInstanceOf(IngestNoLeaseException);
    expect(prisma.ingest_log.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'tally', refused: 'no_lease' }) });
  });
});

describe('IngestService.ingestSeats — under the seat locks', () => {
  it('locks the shard seats in sorted order inside the transaction (one statement), then reads and writes', async () => {
    const { svc, prisma } = make();
    const order: string[] = [];
    prisma.$executeRaw = jest.fn(async (strings: TemplateStringsArray, ...vals: unknown[]) => { order.push(strings.join('?').includes('pg_advisory_xact_lock') ? `lock:${(vals[1] as string[]).join(',')}` : 'write'); return 1; });
    prisma.seat_ingest_state.findMany = jest.fn(async () => { order.push('read'); return []; });
    const s2 = { const_id: 'S2', state: 'counting', votes: { c: 3, d: 1 } };
    await svc.ingestSeats('e', { id: 'k' }, body([s2, s1]), NOW);
    expect(order.slice(0, 2)).toEqual(['lock:S1,S2', 'read']);
    expect(order).toContain('write');
  });
  it('a seat rejected by the seat rules is recorded on seat_ingest_state; not_in_shard / duplicate are not', async () => {
    const { svc, prisma } = make();
    const sql: { text: string; vals: unknown[] }[] = [];
    prisma.$executeRaw = jest.fn(async (strings: TemplateStringsArray, ...vals: unknown[]) => { sql.push({ text: strings.join('?'), vals }); return 1; });
    await svc.ingestSeats('e', { id: 'k' }, body([{ const_id: 'S2', state: 'counting', votes: { c: 1 } }, { const_id: 'S9', state: 'counting', votes: {} }]), NOW);
    const ins = sql.find(q => q.text.includes('last_rejected_reason, last_rejected_at)'));
    expect(ins?.vals).toEqual(expect.arrayContaining([['S2'], ['roster_mismatch']]));
  });
});

describe('IngestService.tally', () => {
  it('the rest shard compares the whole election; another shard only its seats unless scope=election', async () => {
    const { svc, prisma } = make();
    prisma.results.findMany = jest.fn(async () => []);
    const t = (shard: string, scope?: string) => svc.tally('e', { id: 'k' }, { shard, source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T04:00:00Z', parties: [], ...(scope ? { scope } : {}) } as any, NOW);
    await t('rest');
    expect(prisma.results.findMany.mock.calls[0][0].where.const_id).toBeUndefined();
    await t('assam-upper');
    expect(prisma.results.findMany.mock.calls[1][0].where.const_id).toEqual({ in: ['S1', 'S2'] });
    await t('assam-upper', 'election');
    expect(prisma.results.findMany.mock.calls[2][0].where.const_id).toBeUndefined();
  });
  it('records the parties whose won/leading differ from ours for the shard', async () => {
    const { svc, prisma } = make();
    prisma.results.findMany = jest.fn(async () => [
      { status: 'WON', candidates: { party_id: 'BJP' } }, { status: 'LEADING', candidates: { party_id: 'INC' } },
    ]);
    const out = await svc.tally('e', { id: 'k' }, { shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T09:41:05+05:30',
      parties: [{ party_id: 'BJP', won: 1, leading: 0 }, { party_id: 'INC', won: 0, leading: 2 }] } as any, NOW);
    expect(out.mismatch).toEqual([{ party_id: 'INC', ours: { won: 0, leading: 1 }, theirs: { won: 0, leading: 2 } }]);
    expect(prisma.ingest_log.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: 'tally' }) }));
  });
});

describe('IngestService.config', () => {
  it('returns the lease expiry but not the holder name', async () => {
    const { svc } = make();
    const exp = new Date(NOW.getTime() + 60_000);
    (svc as any).shards.get = jest.fn(async () => ({ name: 'rest', source_override: null, seat_ids: ['S1'], lease_holder: 'cloud-1', lease_expires_at: exp }));
    const cfg = await svc.config('e', 'rest');
    expect(cfg.lease).toEqual({ expires_at: exp });
    expect(JSON.stringify(cfg)).not.toContain('cloud-1');
  });
});
