import { IngestService } from './ingest.service';

/** The roster tells the worker whether the election's baseline is ready (seat analysis Phase B). */
describe('IngestService.roster baseline freshness', () => {
  function svc(baselineAt: Date | null, lastCandidate: Date | null) {
    const prisma: any = {
      elections: { findUnique: jest.fn(async () => ({ id: 'e', type: 'VS', state_id: 1, year: 2027, status: 'Live' })) },
      constituencies: { findMany: jest.fn(async () => []) },
      candidates: { findMany: jest.fn(async () => []), aggregate: jest.fn(async () => ({ _max: { updated_at: lastCandidate } })) },
      parties: { findMany: jest.fn(async () => []) },
      election_analysis: { findUnique: jest.fn(async () => (baselineAt ? { baseline_computed_at: baselineAt } : null)) },
    };
    return new IngestService(prisma, {} as any, {} as any, {} as any);
  }
  it('missing → stale; older than the last candidate change → stale; newer → fresh', async () => {
    expect((await svc(null, new Date('2027-02-20')).roster('e')).baseline).toEqual({ computed_at: null, stale: true });
    expect((await svc(new Date('2027-02-25'), new Date('2027-02-26')).roster('e')).baseline).toEqual({ computed_at: '2027-02-25T00:00:00.000Z', stale: true });
    expect((await svc(new Date('2027-02-26'), new Date('2027-02-25')).roster('e')).baseline).toEqual({ computed_at: '2027-02-26T00:00:00.000Z', stale: false });
  });
});
