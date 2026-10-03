import { ResultsService } from './results.service';

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
