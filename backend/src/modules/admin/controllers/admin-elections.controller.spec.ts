import { ForbiddenException } from '@nestjs/common';
import { AdminElectionsController } from './admin-elections.controller';
import { ElectionNotFinalizedException } from '../../../common/exceptions';

/** Status changes go through ElectionLifecycleService (its rules are tested there); the routes only delegate. */
describe('AdminElectionsController: status changes', () => {
  function make(status = 'Live', transition = jest.fn(async (_id: string, to: string) => ({ id: 'e', status: to }))) {
    const electionsService: any = { findOne: jest.fn(async () => ({ id: 'e', status })), update: jest.fn(async (_id: string, b: any) => ({ id: 'e', status, ...b })) };
    const audit = { log: jest.fn(async () => undefined) };
    const ctrl = new AdminElectionsController(electionsService, {} as any, {} as any, { transition } as any, audit as any);
    return { ctrl, electionsService, transition, audit };
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

describe('AdminElectionsController: list', () => {
  it('GET /admin/elections lists every election with manifest_published, through the admin service method', async () => {
    const rows = [{ id: 'e', name: 'X', manifest_published: true }];
    const electionsService: any = { findAllForAdmin: jest.fn(async () => rows) };
    const ctrl = new AdminElectionsController(electionsService, {} as any, {} as any, {} as any, {} as any);
    expect(await ctrl.listElections({ type: 'VS' } as any)).toEqual(rows);
    expect(electionsService.findAllForAdmin).toHaveBeenCalledWith({ type: 'VS', status: undefined, state_id: undefined, year: undefined });
  });
});

describe('AdminElectionsController: audit rows (U2)', () => {
  const req = { user: { id: 'u1', role: 'EDITOR' } };
  function make() {
    const before = { id: 'e', name: 'Old', year: 2025, status: 'Upcoming', states: { id: 1 }, updated_at: new Date(1) };
    const electionsService: any = {
      findOne: jest.fn(async () => before),
      create: jest.fn(async (b: any) => ({ id: 'new', ...b, manifest_url: null })),
      update: jest.fn(async (_id: string, b: any) => ({ ...before, states: undefined, ...b, updated_at: new Date(2) })),
    };
    const manifests: any = {
      saveDraft: jest.fn(async (id: string) => ({ election_id: id, status: 'draft_saved' })),
      publish: jest.fn(async (id: string) => ({ election_id: id, status: 'published' })),
    };
    const audit = { log: jest.fn(async () => undefined) };
    const ctrl = new AdminElectionsController(electionsService, manifests, {} as any, { transition: jest.fn() } as any, audit as any);
    return { ctrl, audit, manifests };
  }
  const rows = (audit: any) => audit.log.mock.calls.map((c: any[]) => c[0]);

  it('ELECTION_CREATE with the new row\'s set fields', async () => {
    const m = make();
    await m.ctrl.createElection({ name: 'Bihar 2030', type: 'VS', year: 2030 } as any, req);
    expect(rows(m.audit)).toEqual([{ userId: 'u1', action: 'ELECTION_CREATE', entityType: 'election', entityId: 'new', newValue: { id: 'new', name: 'Bihar 2030', type: 'VS', year: 2030 } }]);
  });

  it('ELECTION_UPDATE with only the edited fields (status changes are audited by the lifecycle)', async () => {
    const m = make();
    await m.ctrl.updateElection('e', { name: 'New', year: 2025 } as any, req);
    expect(rows(m.audit)).toEqual([{ userId: 'u1', action: 'ELECTION_UPDATE', entityType: 'election', entityId: 'e', oldValue: { name: 'Old' }, newValue: { name: 'New' } }]);
  });

  it('MANIFEST_SAVE (a summary, not the whole draft) and MANIFEST_PUBLISH', async () => {
    const m = make();
    const draft = { alliances: [{ id: 'NDA', name: 'NDA', color: '#f00', parties: ['BJP'] }], tracked: ['BJP'] };
    await m.ctrl.saveManifestDraft('e', draft as any, req);
    expect(m.manifests.saveDraft).toHaveBeenCalledWith('e', draft);
    await m.ctrl.publishManifest('e', req);
    expect(rows(m.audit)).toEqual([
      { userId: 'u1', action: 'MANIFEST_SAVE', entityType: 'election', entityId: 'e', newValue: { keys: ['alliances', 'tracked'], bytes: JSON.stringify(draft).length } },
      { userId: 'u1', action: 'MANIFEST_PUBLISH', entityType: 'election', entityId: 'e' },
    ]);
  });
});

describe('AdminElectionsController: manifest draft body (U3)', () => {
  it('the route validates against ManifestDraftDto and stores plain JSON', async () => {
    const { ManifestDraftDto } = await import('../../manifests/dto/manifest-draft.dto');
    const types = Reflect.getMetadata('design:paramtypes', AdminElectionsController.prototype, 'saveManifestDraft');
    expect(types[1]).toBe(ManifestDraftDto);
    const manifests: any = { saveDraft: jest.fn(async () => ({})) };
    const ctrl = new AdminElectionsController({} as any, manifests, {} as any, {} as any, { log: jest.fn() } as any);
    const dto = Object.assign(new ManifestDraftDto(), { tracked: ['BJP'] });
    await ctrl.saveManifestDraft('e', dto, { user: { id: 'u1' } });
    const stored = manifests.saveDraft.mock.calls[0][1];
    expect(stored).toEqual({ tracked: ['BJP'] });
    expect(Object.getPrototypeOf(stored)).toBe(Object.prototype);
  });

  it('a JSON array body is refused (the ValidationPipe validates arrays element-wise)', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    const manifests: any = { saveDraft: jest.fn() };
    const ctrl = new AdminElectionsController({} as any, manifests, {} as any, {} as any, { log: jest.fn() } as any);
    await expect(ctrl.saveManifestDraft('e', [] as any, { user: { id: 'u1' } })).rejects.toBeInstanceOf(BadRequestException);
    expect(manifests.saveDraft).not.toHaveBeenCalled();
  });
});
