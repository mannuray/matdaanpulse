import { AdminConstituenciesController } from './admin-constituencies.controller';

describe('AdminConstituenciesController: seat analysis audit (U2)', () => {
  const req = { user: { id: 'u1' } };
  function make() {
    const constituencies = { updateAnalysis: jest.fn(async (id: string, b: any) => ({ id, ...b })) };
    const seatAnalysis = { computeFor: jest.fn(async () => ({ computed: 243, kind: 'final' })) };
    const audit = { log: jest.fn(async () => undefined) };
    const ctrl = new AdminConstituenciesController(constituencies as any, audit as any, seatAnalysis as any);
    return { ctrl, constituencies, audit };
  }

  it('compute writes ANALYSIS_COMPUTE with what was computed', async () => {
    const m = make();
    await expect(m.ctrl.computeAnalysis('e1', req)).resolves.toEqual({ computed: 243, kind: 'final' });
    expect(m.audit.log).toHaveBeenCalledWith({
      userId: 'u1', action: 'ANALYSIS_COMPUTE', entityType: 'election', entityId: 'e1', newValue: { computed: 243, kind: 'final' },
    });
  });

  it('a notes edit passes the caller to the service (which writes ANALYSIS_NOTES_UPDATE)', async () => {
    const m = make();
    await m.ctrl.updateAnalysis('a1', { notes: 'n' } as any, req);
    expect(m.constituencies.updateAnalysis).toHaveBeenCalledWith('a1', { notes: 'n' }, 'u1');
  });
});
