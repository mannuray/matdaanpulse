import { AdminElectionsController } from './admin-elections.controller';

/** Finalizing an election stores its final seat analysis (spec 2026-10-07-seat-analysis-design.md §4.5). */
describe('AdminElectionsController: seat analysis on finalize', () => {
  function make(status: string, compute: jest.Mock) {
    const electionsService: any = {
      findOne: jest.fn(async () => ({ id: 'e', status })),
      finalize: jest.fn(async () => ({ id: 'e', status: 'Finalized' })),
      update: jest.fn(async (_id: string, body: any) => ({ id: 'e', status: body.status ?? status })),
    };
    const resultsService: any = { purgeElectionCache: jest.fn(async () => undefined) };
    const liveState: any = { invalidate: jest.fn() };
    return new AdminElectionsController(electionsService, {} as any, resultsService, liveState, { compute } as any);
  }

  it('finalize computes once; a compute failure does not fail the finalize', async () => {
    const compute = jest.fn().mockRejectedValueOnce(new Error('boom'));
    await expect(make('Live', compute).finalizeElection('e')).resolves.toMatchObject({ status: 'Finalized' });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(compute).toHaveBeenCalledWith('e');
  });

  it('an update to Finalized computes; other updates and re-finalizing do not', async () => {
    const compute = jest.fn(async () => ({ computed: 1 }));
    await make('Live', compute).updateElection('e', { status: 'Finalized' } as any);
    await make('Live', compute).updateElection('e', { name: 'x' } as any);
    await make('Finalized', compute).updateElection('e', { status: 'Finalized' } as any);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
