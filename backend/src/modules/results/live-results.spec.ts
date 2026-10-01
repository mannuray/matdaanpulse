import { ResultsService } from './results.service';

describe('ResultsService.getLiveResults', () => {
  it('includes the constituency round fields', async () => {
    const prisma = {
      constituencies: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', name: 'Patna Sahib', const_no: 142, type: 'GEN', current_round: 4, total_rounds: 24, results: [] },
        ]),
      },
    };
    const svc = Object.create(ResultsService.prototype) as ResultsService;
    (svc as any).prisma = prisma;
    const out = await svc.getLiveResults('e1');
    expect(out[0]).toMatchObject({ const_id: 'c1', current_round: 4, total_rounds: 24 });
    expect(prisma.constituencies.findMany.mock.calls[0][0].select).toMatchObject({ current_round: true, total_rounds: true });
  });
});
