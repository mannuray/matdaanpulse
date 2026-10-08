import { ForbiddenException } from '@nestjs/common';
import { ElectionLifecycleService } from './election-lifecycle.service';

function make(status: string) {
  const calls: string[] = [];
  const elections: any = {
    findOne: jest.fn(async () => ({ id: 'e', status })),
    update: jest.fn(async (_id: string, b: any) => { calls.push(`status:${b.status}`); return { id: 'e', status: b.status }; }),
  };
  const analysis: any = { compute: jest.fn(async () => { calls.push('compute'); }), computeBaseline: jest.fn(async () => { calls.push('baseline'); }) };
  const results: any = { purgeElectionCache: jest.fn(async () => { calls.push('purge'); }) };
  const liveState: any = { invalidate: jest.fn(() => calls.push('invalidate')) };
  const audit: any = { log: jest.fn(async () => undefined) };
  return { svc: new ElectionLifecycleService(elections, analysis, results, liveState, audit), elections, analysis, audit, calls };
}
const editor = { id: 'u1', role: 'EDITOR' }, admin = { id: 'u2', role: 'SUPER_ADMIN' };

describe('ElectionLifecycleService.transition', () => {
  it('an editor may take an election Live (baseline computed after the flip) but not finalize or reopen', async () => {
    const up = make('Upcoming');
    await expect(up.svc.transition('e', 'Live', editor)).resolves.toMatchObject({ status: 'Live' });
    expect(up.calls).toEqual(['status:Live', 'baseline', 'invalidate', 'purge']);
    await expect(make('Live').svc.transition('e', 'Finalized', editor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(make('Finalized').svc.transition('e', 'Live', editor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(make('Upcoming').svc.transition('e', 'Finalized', editor)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('finalizing computes the final analysis before the status flips; a compute failure does not stop it', async () => {
    const m = make('Live');
    m.analysis.compute.mockRejectedValueOnce(new Error('boom'));
    await expect(m.svc.transition('e', 'Finalized', admin)).resolves.toMatchObject({ status: 'Finalized' });
    expect(m.calls).toEqual(['status:Finalized', 'invalidate', 'purge']);
    const ok = make('Live');
    await ok.svc.transition('e', 'Finalized', admin);
    expect(ok.calls).toEqual(['compute', 'status:Finalized', 'invalidate', 'purge']);
  });
  it('reopening (Finalized → Live) is a super admin action with its ELECTION_REOPEN audit row; every change is audited', async () => {
    const m = make('Finalized');
    await m.svc.transition('e', 'Live', admin);
    expect(m.audit.log).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2', action: 'ELECTION_REOPEN', entityType: 'election', entityId: 'e' }));
    const g = make('Upcoming');
    await g.svc.transition('e', 'Live', editor);
    expect(g.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ELECTION_STATUS', oldValue: { status: 'Upcoming' }, newValue: { status: 'Live' } }));
  });
  it('the same status is a no-op (no hooks, no audit)', async () => {
    const m = make('Live');
    await m.svc.transition('e', 'Live', editor);
    expect(m.calls).toEqual([]);
    expect(m.audit.log).not.toHaveBeenCalled();
  });
});
