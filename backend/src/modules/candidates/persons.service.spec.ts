import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PersonsService } from './persons.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person-input.dto';
import { PersonProfileDto } from './dto/candidate-response.dto';

const person = {
  id: 'p1', name: 'Nitish Kumar', gender: 'M', education: null, date_of_birth: new Date('1951-03-01'),
  bio: 'old bio', wikipedia_url: 'https://en.wikipedia.org/wiki/N', updated_at: new Date(1),
};

function make() {
  const prisma = {
    persons: {
      findUnique: jest.fn(async () => person),
      update: jest.fn(async ({ data }) => ({ ...person, ...data, updated_at: new Date(2) })),
    },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
  };
  const svc = new PersonsService(prisma as any, new AuditLogService(prisma as any));
  return { svc, prisma };
}

describe('PersonsService audit rows', () => {
  it('update writes one PERSON_UPDATE row with only the changed fields (bio is a column)', async () => {
    const { svc, prisma } = make();
    await svc.update('p1', { name: 'Nitish Kumar', bio: 'new bio', date_of_birth: '1951-03-01', education: 'B.E.', caste: 'Kurmi' }, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.persons.update.mock.calls[0][0].data).toMatchObject({ bio: 'new bio', caste: 'Kurmi' });
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'PERSON_UPDATE', entity_type: 'person', entity_id: 'p1',
      old_value: { education: null, bio: 'old bio', caste: null },
      new_value: { education: 'B.E.', bio: 'new bio', caste: 'Kurmi' },
    });
  });

  it('an audit failure still returns the updated person', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.update('p1', { education: 'B.E.' }, 'u1')).resolves.toMatchObject({ education: 'B.E.' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

const keeperRow = {
  id: 'p1', name: 'Nitish Kumar', photo_url: null, gender: 'M', education: null, date_of_birth: null, bio: 'keeper bio',
  wikipedia_url: null, caste: null, religion: null, state_id: 5, district_id: null, region_id: null, updated_at: new Date(1),
};
const duplicateRow = {
  id: 'p2', name: 'N. Kumar', photo_url: 'https://x/p.jpg', gender: 'F', education: 'B.E.', date_of_birth: new Date('1951-03-01'),
  bio: 'dup bio', wikipedia_url: null, caste: 'Kurmi', religion: null, state_id: 5, district_id: 7, region_id: 3, updated_at: new Date(1),
};

function makeMerge(over: { keeper?: object; duplicate?: object } = {}) {
  const keeper = { ...keeperRow, ...over.keeper };
  const duplicate = { ...duplicateRow, ...over.duplicate };
  const tx = {
    persons: {
      findUnique: jest.fn(async ({ where }) => (where.id === 'p1' ? keeper : where.id === 'p2' ? duplicate : null)),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    candidates: {
      findMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    person_merges: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)), audit_logs: { create: jest.fn() } };
  return { svc: new PersonsService(prisma as any, new AuditLogService(prisma as any)), prisma, tx };
}

describe('PersonsService.merge', () => {
  it('snapshots the duplicate and its candidates, fills only NULL keeper fields, moves, logs and audits in one transaction', async () => {
    const { svc, prisma, tx } = makeMerge();
    await expect(svc.merge('p2', 'p1', 'u1')).resolves.toEqual({ merged: true, target_id: 'p1', merge_id: 'm1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Keeper had gender M and a bio: kept. NULL fields take the duplicate's values (same state, so district/region too).
    expect(tx.persons.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { photo_url: 'https://x/p.jpg', education: 'B.E.', date_of_birth: duplicateRow.date_of_birth, caste: 'Kurmi', district_id: 7, region_id: 3 },
    });
    // The candidate ids were read before the move (the orphan trigger deletes the duplicate when its last one moves).
    expect(tx.candidates.findMany.mock.invocationCallOrder[0]).toBeLessThan(tx.candidates.updateMany.mock.invocationCallOrder[0]);
    // Only rows still on the duplicate move (a concurrent change person is caught by the count).
    expect(tx.candidates.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c1', 'c2'] }, person_id: 'p2' }, data: { person_id: 'p1' } });
    expect(tx.persons.deleteMany).toHaveBeenCalledWith({ where: { id: 'p2' } });
    const log = tx.person_merges.create.mock.calls[0][0].data;
    expect(log).toEqual({
      keeper_id: 'p1', keeper_ref: 'p1', candidate_ids: ['c1', 'c2'], merged_by: 'u1',
      duplicate: {
        id: 'p2', name: 'N. Kumar', photo_url: 'https://x/p.jpg', gender: 'F', education: 'B.E.', date_of_birth: '1951-03-01T00:00:00.000Z',
        bio: 'dup bio', wikipedia_url: null, caste: 'Kurmi', religion: null, state_id: 5, district_id: 7, region_id: 3,
      },
      filled_fields: { photo_url: null, education: null, date_of_birth: null, caste: null, district_id: null, region_id: null },
    });
    expect(tx.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'PERSON_MERGE', entity_type: 'person', entity_id: 'p1',
      old_value: { source_id: 'p2', source_name: 'N. Kumar' },
      new_value: { target_id: 'p1', merge_id: 'm1', candidates_moved: 2, filled_fields: ['photo_url', 'education', 'date_of_birth', 'caste', 'district_id', 'region_id'] },
    });
  });

  it('district and region are not filled from a duplicate in another state', async () => {
    const { svc, tx } = makeMerge({ duplicate: { state_id: 9 } });
    await svc.merge('p2', 'p1', 'u1');
    const data = tx.persons.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('district_id');
    expect(data).not.toHaveProperty('region_id');
  });

  it('a keeper with nothing to fill is not updated and the log has no filled fields', async () => {
    const { svc, tx } = makeMerge({ duplicate: { ...Object.fromEntries(Object.keys(duplicateRow).map((k) => [k, null])), id: 'p2', name: 'N. Kumar' } });
    await svc.merge('p2', 'p1', 'u1');
    expect(tx.persons.update).not.toHaveBeenCalled();
    expect(tx.person_merges.create.mock.calls[0][0].data.filled_fields).toEqual({});
  });

  it('rejects merging a person into itself, and an unknown person is a 404', async () => {
    const { svc, tx } = makeMerge();
    await expect(svc.merge('p1', 'p1')).rejects.toMatchObject({ status: 400 });
    expect((await svc.merge('p9', 'p1').catch((e) => e)).getStatus()).toBe(404);
    expect(tx.candidates.updateMany).not.toHaveBeenCalled();
  });

  it('a candidate that left the duplicate during the merge (short move count) is a 409, and nothing after the move runs', async () => {
    const { svc, tx } = makeMerge();
    tx.candidates.updateMany.mockResolvedValue({ count: 1 });
    const err = await svc.merge('p2', 'p1', 'u1').catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({ details: { expected: 2, moved: 1 } });
    expect(tx.persons.deleteMany).not.toHaveBeenCalled();
    expect(tx.person_merges.create).not.toHaveBeenCalled();
    expect(tx.audit_logs.create).not.toHaveBeenCalled();
  });

  it('a failing audit insert inside the merge still merges', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, tx } = makeMerge();
    tx.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.merge('p2', 'p1', 'u1')).resolves.toMatchObject({ merged: true });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT audit_row');
    warn.mockRestore();
  });
});

describe('PersonsService.undoMerge', () => {
  const snapshot = {
    id: 'p2', name: 'N. Kumar', photo_url: 'https://x/p.jpg', gender: 'F', education: 'B.E.', date_of_birth: '1951-03-01T00:00:00.000Z',
    bio: 'dup bio', wikipedia_url: null, caste: 'Kurmi', religion: null, state_id: 5, district_id: 7, region_id: 3,
  };
  const log = {
    id: 'm1', keeper_id: 'p1', keeper_ref: 'p1', duplicate: snapshot, candidate_ids: ['c1', 'c2'],
    filled_fields: { photo_url: null, education: null, caste: null }, undone_at: null,
  };
  /** The keeper after the merge, where the editor later changed the education the merge had filled. */
  const keeperNow = { ...keeperRow, photo_url: 'https://x/p.jpg', education: 'M.A.', caste: 'Kurmi' };

  function makeUndo(over: { log?: object | null; candidates?: object[]; claimed?: number; keeperGone?: boolean; movedBack?: number } = {}) {
    const order: string[] = [];
    let moved = false;
    const tx = {
      person_merges: {
        findUnique: jest.fn().mockResolvedValue(over.log === undefined ? log : over.log),
        updateMany: jest.fn(async ({ where }) => {
          if (where.keeper_ref) { order.push('repoint'); return { count: 0 }; }
          order.push('claim');
          return { count: over.claimed ?? 1 };
        }),
      },
      candidates: {
        findMany: jest.fn().mockResolvedValue(over.candidates ?? [{ id: 'c1', name: 'N KUMAR', person_id: 'p1' }, { id: 'c2', name: 'NITISH', person_id: 'p1' }]),
        updateMany: jest.fn(async () => { order.push('move'); moved = true; return { count: over.movedBack ?? 2 }; }),
      },
      persons: {
        findUnique: jest.fn(async ({ where }) => (where.id === 'p1' && !(moved && over.keeperGone) ? keeperNow : null)),
        create: jest.fn(async () => { order.push('create'); return {}; }),
        update: jest.fn(async ({ data }) => { order.push('restore'); return { ...keeperNow, ...data }; }),
      },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)), audit_logs: { create: jest.fn() } };
    const audit = () => tx.audit_logs.create.mock.calls.map((c: any) => c[0].data);
    return { svc: new PersonsService(prisma as any, new AuditLogService(prisma as any)), tx, prisma, order, audit };
  }

  it('recreates the duplicate with its id and fields, restores only the filled fields the keeper still holds, moves the candidates back', async () => {
    const { svc, tx, prisma, order, audit } = makeUndo();
    await expect(svc.undoMerge('m1', 'u1')).resolves.toEqual({ undone: true, merge_id: 'm1', person_id: 'p2', keeper_id: 'p1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.person_merges.updateMany).toHaveBeenCalledWith({ where: { id: 'm1', undone_at: null }, data: { undone_at: expect.any(Date), undone_by: 'u1' } });
    expect(tx.persons.create).toHaveBeenCalledWith({ data: { ...snapshot, date_of_birth: new Date('1951-03-01') } });
    // education was changed by an editor after the merge: left alone.
    expect(tx.persons.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { photo_url: null, caste: null } });
    // Only rows still on the keeper move back.
    expect(tx.candidates.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c1', 'c2'] }, person_id: 'p1' }, data: { person_id: 'p2' } });
    // Older merges kept on the recreated person point at it again.
    expect(tx.person_merges.updateMany).toHaveBeenCalledWith({ where: { keeper_ref: 'p2' }, data: { keeper_id: 'p2' } });
    expect(order).toEqual(['claim', 'create', 'repoint', 'restore', 'move']);
    expect(audit()).toEqual([{
      user_id: 'u1', action: 'PERSON_MERGE_UNDO', entity_type: 'person', entity_id: 'p1',
      old_value: { merge_id: 'm1', target_id: 'p1' },
      new_value: { source_id: 'p2', source_name: 'N. Kumar', candidates_moved: 2, restored_fields: ['photo_url', 'caste'] },
    }]);
  });

  it('an unknown merge is a 404', async () => {
    const { svc } = makeUndo({ log: null });
    expect((await svc.undoMerge('m9').catch((e) => e)).getStatus()).toBe(404);
  });

  it('an undone merge is a 409, also when a concurrent undo claimed it first', async () => {
    const a = makeUndo({ log: { ...log, undone_at: new Date() } });
    expect((await a.svc.undoMerge('m1').catch((e) => e)).getStatus()).toBe(409);
    expect(a.tx.persons.create).not.toHaveBeenCalled();
    const b = makeUndo({ claimed: 0 });
    expect((await b.svc.undoMerge('m1').catch((e) => e)).getStatus()).toBe(409);
    expect(b.tx.persons.create).not.toHaveBeenCalled();
  });

  it('a merge whose keeper is gone (no person with id keeper_ref) is a 409', async () => {
    const { svc, tx } = makeUndo({ log: { ...log, keeper_id: null, keeper_ref: 'p9' } });
    const err = await svc.undoMerge('m1').catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse().message).toMatch(/no longer exists/);
    expect(tx.person_merges.updateMany).not.toHaveBeenCalled();
  });

  it('keeper_id null but the keeper_ref person back (a later merge was undone): the undo goes ahead on keeper_ref', async () => {
    const { svc, tx } = makeUndo({ log: { ...log, keeper_id: null } });
    await expect(svc.undoMerge('m1', 'u1')).resolves.toMatchObject({ undone: true, keeper_id: 'p1' });
    expect(tx.persons.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('a candidate that left the keeper during the undo (short move-back count) is a 409', async () => {
    const { svc, tx, audit } = makeUndo({ movedBack: 1 });
    const err = await svc.undoMerge('m1', 'u1').catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({ details: { merge_id: 'm1', expected: 2, moved: 1 } });
    expect(tx.candidates.updateMany).toHaveBeenCalledTimes(1);
    expect(audit()).toEqual([]);
  });

  it('a candidate moved or deleted since is a 409 naming them, before any write', async () => {
    const { svc, tx } = makeUndo({ candidates: [{ id: 'c1', name: 'N KUMAR', person_id: 'p7' }] });
    const err = await svc.undoMerge('m1').catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({
      message: "Can't undo this merge: N KUMAR, deleted candidate c2 no longer belong to this person.",
      details: { moved: [{ id: 'c1', name: 'N KUMAR' }], missing: ['c2'] },
    });
    expect(tx.persons.create).not.toHaveBeenCalled();
    expect(tx.persons.update).not.toHaveBeenCalled();
    expect(tx.candidates.updateMany).not.toHaveBeenCalled();
  });

  it('a keeper left with no candidates is deleted by the trigger and audited as PERSON_DELETE', async () => {
    const { svc, audit } = makeUndo({ keeperGone: true });
    await svc.undoMerge('m1', 'u1');
    expect(audit().map((a: any) => [a.action, a.entity_id])).toEqual([['PERSON_MERGE_UNDO', 'p1'], ['PERSON_DELETE', 'p1']]);
  });
});

describe('PersonsService.mergeHistory', () => {
  it('lists merges newest first; undoable only when not undone and every candidate is still on the person', async () => {
    const rows = [
      { id: 'm3', duplicate: { name: 'A' }, candidate_ids: ['c1'], merged_at: new Date(3), undone_at: null, merger: { name: 'Priya' } },
      { id: 'm2', duplicate: { name: 'B' }, candidate_ids: ['c2', 'c9'], merged_at: new Date(2), undone_at: null, merger: null },
      { id: 'm1', duplicate: { name: 'C' }, candidate_ids: ['c3'], merged_at: new Date(1), undone_at: new Date(4), merger: { name: 'Priya' } },
    ];
    const prisma = { person_merges: { findMany: jest.fn().mockResolvedValue(rows) } };
    const svc = new PersonsService(prisma as any, {} as any);
    const out = await svc.mergeHistory('p1', ['c1', 'c2', 'c3']);
    expect(prisma.person_merges.findMany.mock.calls[0][0]).toMatchObject({ where: { keeper_ref: 'p1' }, orderBy: { merged_at: 'desc' } });
    expect(out).toEqual([
      { id: 'm3', duplicate_name: 'A', candidate_count: 1, merged_at: new Date(3), merged_by: 'Priya', undoable: true, undone_at: null, not_undoable_reason: null },
      { id: 'm2', duplicate_name: 'B', candidate_count: 2, merged_at: new Date(2), merged_by: null, undoable: false, undone_at: null, not_undoable_reason: 'contests_moved' },
      { id: 'm1', duplicate_name: 'C', candidate_count: 1, merged_at: new Date(1), merged_by: 'Priya', undoable: false, undone_at: new Date(4), not_undoable_reason: 'undone' },
    ]);
  });
});

describe('PersonsService.findAll contests filter', () => {
  function makeList() {
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }]),
      persons: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', name: 'Z', states: null, regions: null, _count: { candidates: 3 }, candidates: [] },
          { id: 'b', name: 'A', states: { name: 'Bihar' }, regions: null, _count: { candidates: 2 }, candidates: [{ election_id: 'e1', elections: { name: 'BR 2025' } }] },
        ]),
      },
    };
    return { svc: new PersonsService(prisma as any, {} as any), prisma };
  }
  const sqlOf = (call: any[]) => (call[0] as TemplateStringsArray).join('?') + JSON.stringify(call.slice(1));

  it('2plus: the page of ids and the total come from SQL with the count condition and the other filters, rows keep that order', async () => {
    const { svc, prisma } = makeList();
    const out = await svc.findAll(2, 10, 'ku_mar', { state_id: 5, contests: '2plus' });
    expect(prisma.persons.count).not.toHaveBeenCalled();
    const [countCall, idsCall] = prisma.$queryRaw.mock.calls;
    const countSql = (countCall[1] as any).sql as string;
    expect(countSql).toMatch(/COUNT\(\*\) FROM candidates c WHERE c\.person_id = p\.id\) >= 2/);
    expect(countSql).toMatch(/p\.name ILIKE/);
    expect(countSql).toMatch(/p\.state_id = /);
    expect((countCall[1] as any).values).toEqual(['%ku\\_mar%', 5]);
    expect(sqlOf(idsCall)).toMatch(/ORDER BY p\.name ASC, p\.id ASC LIMIT \? OFFSET \?\[.*,10,10\]/);
    expect(prisma.persons.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['b', 'a'] } });
    expect(out.data.map((p: any) => p.id)).toEqual(['b', 'a']);
    expect(out.data[0]).toMatchObject({ state_name: 'Bihar', candidate_count: 2, elections: ['BR 2025'] });
    expect(out.meta).toMatchObject({ total: 2, page: 2, limit: 10 });
  });

  it('1: exactly one candidacy', async () => {
    const { svc, prisma } = makeList();
    await svc.findAll(1, 100, '', { contests: '1' });
    expect((prisma.$queryRaw.mock.calls[0][1] as any).sql).toMatch(/p\.id\) = 1$/);
  });

  it('0: no candidacies (persons created on their own, before or by POST /admin/persons)', async () => {
    const { svc, prisma } = makeList();
    await svc.findAll(1, 100, '', { contests: '0' });
    expect((prisma.$queryRaw.mock.calls[0][1] as any).sql).toMatch(/p\.id\) = 0$/);
  });

  it('without contests the Prisma path is used, and candidates are selected narrowly (no BigInt affidavit columns)', async () => {
    const { svc, prisma } = makeList();
    await svc.findAll(1, 100, 'x', { region_id: 3 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const args = prisma.persons.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ name: { contains: 'x', mode: 'insensitive' }, region_id: 3 });
    expect(args.include.candidates).toEqual({ select: { election_id: true, elections: { select: { name: true } } }, distinct: ['election_id'] });
  });
});

describe('Person input DTOs', () => {
  it.each([['update', UpdatePersonDto], ['create', CreatePersonDto]] as const)('%s maps every blank nullable text field to null', async (_, cls) => {
    const blank = { name: 'N', gender: '', education: '', bio: '', photo_url: '', date_of_birth: '', wikipedia_url: '', caste: '', religion: '' };
    const dto = plainToInstance(cls, blank) as unknown as Record<string, unknown>;
    expect(await validate(dto)).toEqual([]);
    for (const k of ['gender', 'education', 'bio', 'photo_url', 'date_of_birth', 'wikipedia_url', 'caste', 'religion']) expect(dto[k]).toBeNull();
    expect(dto.name).toBe('N');
  });
});

describe('Person input DTOs through the ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  it('rejects metadata (dropped in migration 018) and accepts caste and religion', async () => {
    await expect(pipe.transform({ metadata: { bio: 'x' } }, { type: 'body', metatype: UpdatePersonDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ caste: 'Kurmi', religion: 'Hindu' }, { type: 'body', metatype: UpdatePersonDto }))
      .resolves.toMatchObject({ caste: 'Kurmi', religion: 'Hindu' });
  });
});

describe('PersonsService.findWithCandidates (public profile)', () => {
  const full = {
    ...person, caste: 'X', religion: 'Y', states: { id: 4, name: 'Bihar' }, districts: { id: 1, name: 'Patna' },
    candidates: [
      { id: 'c1', name: 'Nitish Kumar', party_id: 'JDU', const_id: 'BR_VS_1_A', election_id: 'e1', is_incumbent: true,
        age: 74, assets: BigInt(16400000), liabilities: null, criminal_cases: 0,
        parties: { id: 'JDU', name: 'Janata Dal (United)', color: '#1fa37a', abbreviation: 'JD(U)', symbol_url: '/symbols/logos/JDU.svg', eci_symbol_url: '/symbols/eci/JDU.jpg' },
        constituencies: { name: 'A', const_no: 1 }, elections: { name: 'Bihar VS 2025', year: 2025, type: 'VS', status: 'Finalized' },
        results: [{ votes: 600, status: 'WON', margin: 200 }] },
      { id: 'c0', name: 'Nitish Kumar', party_id: 'JDU', const_id: 'BR_VS2020_1_A', election_id: 'e0', is_incumbent: false,
        age: null, assets: null, liabilities: null, criminal_cases: null, parties: null,
        constituencies: { name: 'A', const_no: 1 }, elections: { name: 'Bihar VS 2020', year: 2020, type: 'VS', status: 'Finalized' },
        results: [] },
    ],
  };
  function make2() {
    const prisma: any = {
      persons: { findUnique: jest.fn().mockResolvedValue(full) },
      results: { groupBy: jest.fn().mockResolvedValue([{ const_id: 'BR_VS_1_A', _sum: { votes: 1000 } }]) },
      image_credits: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    return { svc: new PersonsService(prisma, new AuditLogService(prisma)), prisma };
  }

  it('adds affidavit, vote share and party marks to each contest', async () => {
    const { svc } = make2();
    const out: any = await svc.findWithCandidates('p1');
    expect(out.candidates[0]).toMatchObject({ age: 74, assets: 16400000, liabilities: null, criminal_cases: 0, vote_share: 60,
      party_abbreviation: 'JD(U)', party_symbol_url: '/symbols/logos/JDU.svg', party_eci_symbol_url: '/symbols/eci/JDU.jpg' });
    expect(out.candidates[1]).toMatchObject({ vote_share: null, party_abbreviation: null, party_symbol_url: null });
  });

  it('adds the photo credit when the photo has one, and null otherwise', async () => {
    const { svc, prisma } = make2();
    expect((await svc.findWithCandidates('p1') as any).photo_credit).toBeNull();
    prisma.persons.findUnique.mockResolvedValue({ ...full, photo_url: 'https://blob.example/persons/Q1/photo.jpg' });
    prisma.image_credits.findUnique.mockResolvedValue({ url: 'https://blob.example/persons/Q1/photo.jpg', source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0', created_at: new Date() });
    const json = JSON.parse(JSON.stringify(plainToInstance(PersonProfileDto, await svc.findWithCandidates('p1'), { excludeExtraneousValues: true })));
    expect(json.photo_credit).toEqual({ source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0' });
  });

  it('the public DTO exposes home state/district and never caste or religion', async () => {
    const { svc } = make2();
    const json = JSON.parse(JSON.stringify(plainToInstance(PersonProfileDto, await svc.findWithCandidates('p1'), { excludeExtraneousValues: true })));
    expect(json.state).toEqual({ id: 4, name: 'Bihar' });
    expect(json.district).toEqual({ id: 1, name: 'Patna' });
    expect(json.caste).toBeUndefined();
    expect(json.religion).toBeUndefined();
    expect(json.candidates[0].assets).toBe(16400000);
  });
});
