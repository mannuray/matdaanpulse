import { Prisma } from '@prisma/client';
import { ManifestsService } from './manifests.service';
import { ManifestNoDraftException, ManifestNotFoundException } from '../../common/exceptions';

/** Minimal in-memory stand-in for prisma.elections covering the fields the service uses. */
function fakePrisma() {
  const rows = new Map<string, any>([['e1', { id: 'e1', manifest_url: null, manifest_draft: null }]]);
  return {
    rows,
    elections: {
      findUnique: jest.fn(async ({ where }: any) => (rows.has(where.id) ? { ...rows.get(where.id) } : null)),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.get(where.id);
        const next = { ...row, ...data };
        if (data.manifest_draft === Prisma.DbNull) next.manifest_draft = null;
        rows.set(where.id, next);
        return next;
      }),
    },
  };
}

describe('ManifestsService (DB-persisted drafts)', () => {
  it('saves a draft to elections.manifest_draft and returns it from getManifest', async () => {
    const prisma = fakePrisma();
    const svc = new ManifestsService(prisma as any);
    const draft = { alliances: [{ id: 'NDA', parties: ['BJP'] }] };

    await expect(svc.saveDraft('e1', draft)).resolves.toEqual({ election_id: 'e1', status: 'draft_saved' });
    expect(prisma.elections.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { manifest_draft: draft } });

    // A fresh service instance (e.g. after restart) still sees the draft.
    const svc2 = new ManifestsService(prisma as any);
    await expect(svc2.getManifest('e1')).resolves.toEqual({ election_id: 'e1', manifest_url: null, draft });
  });

  it('publish copies the draft into manifest_url and clears the draft', async () => {
    const prisma = fakePrisma();
    const svc = new ManifestsService(prisma as any);
    const draft = { alliances: [] };
    await svc.saveDraft('e1', draft);

    await expect(svc.publish('e1')).resolves.toEqual({ election_id: 'e1', status: 'published' });
    expect(prisma.rows.get('e1')).toMatchObject({ manifest_url: JSON.stringify(draft), manifest_draft: null });
    await expect(svc.publish('e1')).rejects.toBeInstanceOf(ManifestNoDraftException);
  });

  it('throws for an unknown election', async () => {
    const svc = new ManifestsService(fakePrisma() as any);
    await expect(svc.getManifest('nope')).rejects.toBeInstanceOf(ManifestNotFoundException);
  });
});
