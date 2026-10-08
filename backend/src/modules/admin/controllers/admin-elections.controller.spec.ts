import { ForbiddenException } from '@nestjs/common';
import { AdminElectionsController } from './admin-elections.controller';
import { ElectionNotFinalizedException } from '../../../common/exceptions';

/** Status changes go through ElectionLifecycleService (its rules are tested there); the routes only delegate. */
describe('AdminElectionsController: status changes', () => {
  function make(status = 'Live', transition = jest.fn(async (_id: string, to: string) => ({ id: 'e', status: to }))) {
    const electionsService: any = { findOne: jest.fn(async () => ({ id: 'e', status })), update: jest.fn(async (_id: string, b: any) => ({ id: 'e', status, ...b })) };
    const ctrl = new AdminElectionsController(electionsService, {} as any, {} as any, { transition } as any);
    return { ctrl, electionsService, transition };
  }
  const editor = { user: { id: 'u1', role: 'EDITOR' } }, admin = { user: { id: 'u2', role: 'SUPER_ADMIN' } };

  it('PATCH with a status goes through the lifecycle with the caller; other fields update without it', async () => {
    const m = make();
    await m.ctrl.updateElection('e', { status: 'Finalized', name: 'X' } as any, editor);
    expect(m.transition).toHaveBeenCalledWith('e', 'Finalized', editor.user);
    expect(m.electionsService.update).toHaveBeenCalledWith('e', { name: 'X' });
    const n = make();
    await n.ctrl.updateElection('e', { name: 'Y' } as any, editor);
    expect(n.transition).not.toHaveBeenCalled();
  });
  it('a refused status change saves nothing', async () => {
    const m = make('Live', jest.fn().mockRejectedValue(new ForbiddenException()));
    await expect(m.ctrl.updateElection('e', { status: 'Finalized', name: 'X' } as any, editor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.electionsService.update).not.toHaveBeenCalled();
  });
  it('finalize and reopen delegate; reopening an election that is not Finalized is refused', async () => {
    const m = make('Live');
    await m.ctrl.finalizeElection('e', admin);
    expect(m.transition).toHaveBeenCalledWith('e', 'Finalized', admin.user);
    await expect(m.ctrl.reopenElection('e', admin)).rejects.toBeInstanceOf(ElectionNotFinalizedException);
    const f = make('Finalized');
    await f.ctrl.reopenElection('e', admin);
    expect(f.transition).toHaveBeenCalledWith('e', 'Live', admin.user);
  });
});
