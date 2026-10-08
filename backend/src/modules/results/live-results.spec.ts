import { ResultsService } from './results.service';

describe('ResultsService.getResults (unversioned rows)', () => {
  it('each row carries person_id, like the versioned snapshot rows (both are ResultRow on the frontend)', async () => {
    const prisma = {
      results: {
        findMany: jest.fn().mockResolvedValue([
          { const_id: 'A', votes: 900, status: 'WON', margin: 120, candidates: { party_id: 'BJP', name: 'X', person_id: 'p1' }, constituencies: { type: 'GEN' } },
          { const_id: 'A', votes: 780, status: 'LOST', margin: null, candidates: { party_id: null, name: 'Y', person_id: null }, constituencies: { type: 'GEN' } },
        ]),
      },
    };
    const svc = Object.create(ResultsService.prototype) as ResultsService;
    (svc as any).prisma = prisma;
    (svc as any).liveState = { get: jest.fn(async () => ({ version: 3 })) };
    (svc as any).cache = { getOrSet: jest.fn((_k: string, _t: number, load: () => unknown) => load()) };
    const rows = await svc.getResults('e1');
    expect(rows).toEqual([
      { const_id: 'A', party_id: 'BJP', candidate_name: 'X', person_id: 'p1', votes: 900, status: 'WON', margin: 120, const_type: 'GEN' },
      { const_id: 'A', party_id: null, candidate_name: 'Y', person_id: null, votes: 780, status: 'LOST', margin: null, const_type: 'GEN' },
    ]);
    expect(prisma.results.findMany.mock.calls[0][0].select.candidates.select).toMatchObject({ person_id: true });
  });
});

describe('ResultsService.getLiveResults', () => {
  it('includes the constituency round fields', async () => {
    const prisma = {
      constituencies: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', name: 'Patna Sahib', const_no: 142, type: 'GEN', current_round: 4, total_rounds: 24, results: [] },
        ]),
      },
      seat_ingest_state: { findMany: jest.fn().mockResolvedValue([{ const_id: 'c1', state: 'countermanded' }]) },
    };
    const svc = Object.create(ResultsService.prototype) as ResultsService;
    (svc as any).prisma = prisma;
    const out = await svc.getLiveResults('e1');
    expect(out[0]).toMatchObject({ const_id: 'c1', current_round: 4, total_rounds: 24, seat_state: 'countermanded' });
    expect(prisma.constituencies.findMany.mock.calls[0][0].select).toMatchObject({ current_round: true, total_rounds: true });
  });

  it('seat_state is null when the seat has no ingest row', async () => {
    const prisma = {
      constituencies: { findMany: jest.fn().mockResolvedValue([{ id: 'c2', name: 'X', const_no: 1, type: 'GEN', current_round: null, total_rounds: null, results: [] }]) },
      seat_ingest_state: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = Object.create(ResultsService.prototype) as ResultsService;
    (svc as any).prisma = prisma;
    expect((await svc.getLiveResults('e1'))[0].seat_state).toBeNull();
  });
});
