import { Logger } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConstituencyNotFoundException, ElectionFinalizedException, ElectionNotFoundException, ErrorCodes } from '../../common/exceptions';

describe('CandidatesService.create', () => {
  function make(seat: unknown = { id: 'BR_VS_1', election_id: 'e1' }, election: unknown = { status: 'Live' }) {
    const order: string[] = [];
    const tx = {
      elections: { findUnique: jest.fn().mockResolvedValue(election) },
      constituencies: { findFirst: jest.fn().mockResolvedValue(seat) },
      candidates: { create: jest.fn().mockResolvedValue({ id: 'c-new', election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi', party_id: 'BJP' }) },
      results: {
        create: jest.fn().mockResolvedValue({ id: 'r-new', const_id: 'BR_VS_1', election_id: 'e1', votes: 0, status: 'TRAILING', margin: 0, round_no: 0 }),
      },
      audit_logs: { create: jest.fn(async (_args: any): Promise<any> => { order.push('audit'); return {}; }) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    };
    const prisma = {
      candidates: { create: jest.fn() },
      results: { create: jest.fn() },
      audit_logs: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => {
        const out = await fn(tx);
        order.push('commit');
        return out;
      }),
    };
    const notifier = { afterCommit: jest.fn(async () => { order.push('afterCommit'); }) };
    const svc = new CandidatesService(prisma as any, notifier as any, new AuditLogService(prisma as any));
    return { svc, tx, prisma, notifier, order };
  }

  const body = { election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi', party_id: 'BJP', metadata: { age: 40 } };

  it('checks the seat belongs to the election, then creates the candidate and its results row in one transaction', async () => {
    const { svc, tx, prisma } = make();
    await expect(svc.create(body as any)).resolves.toMatchObject({ id: 'c-new' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.constituencies.findFirst).toHaveBeenCalledWith({ where: { id: 'BR_VS_1', election_id: 'e1' }, select: { id: true } });
    expect(tx.candidates.create).toHaveBeenCalledWith({ data: body });
    expect(tx.results.create).toHaveBeenCalledWith({
      data: { candidate_id: 'c-new', const_id: 'BR_VS_1', election_id: 'e1', votes: 0, status: 'TRAILING', margin: 0 },
    });
    // Nothing is written outside the transaction.
    expect(prisma.candidates.create).not.toHaveBeenCalled();
    expect(prisma.results.create).not.toHaveBeenCalled();
  });

  it('rejects a seat of another election with ConstituencyNotFound (404) and writes nothing', async () => {
    const { svc, tx, notifier } = make(null);
    const err = await svc.create(body as any).catch((e) => e);
    expect(err).toBeInstanceOf(ConstituencyNotFoundException);
    expect(err.getStatus()).toBe(404);
    expect(tx.candidates.create).not.toHaveBeenCalled();
    expect(tx.results.create).not.toHaveBeenCalled();
    expect(notifier.afterCommit).not.toHaveBeenCalled();
  });

  it('rejects an unknown election with ElectionNotFound (404) and writes nothing', async () => {
    const { svc, tx } = make(undefined, null);
    const err = await svc.create(body as any).catch((e) => e);
    expect(err).toBeInstanceOf(ElectionNotFoundException);
    expect(tx.candidates.create).not.toHaveBeenCalled();
  });

  it('rejects a Finalized election with 409 ELECTION_FINALIZED, checked in the transaction before any write', async () => {
    const { svc, tx, notifier } = make(undefined, { status: 'Finalized' });
    const err = await svc.create(body as any).catch((e) => e);
    expect(err).toBeInstanceOf(ElectionFinalizedException);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({ code: ErrorCodes.ELECTION_FINALIZED });
    expect(tx.elections.findUnique).toHaveBeenCalledWith({ where: { id: 'e1' }, select: { status: true } });
    expect(tx.candidates.create).not.toHaveBeenCalled();
    expect(tx.results.create).not.toHaveBeenCalled();
    expect(notifier.afterCommit).not.toHaveBeenCalled();
  });

  it('runs the result post-commit steps once, after the commit, with the new results row', async () => {
    const { svc, notifier, order } = make();
    await svc.create(body as any);
    expect(order).toEqual(['audit', 'commit', 'afterCommit']);
    expect(notifier.afterCommit).toHaveBeenCalledTimes(1);
    expect(notifier.afterCommit).toHaveBeenCalledWith(
      'e1',
      [{ const_id: 'BR_VS_1', p: 'BJP', m: 0, s: 'TRAILING', r: 0 }],
      { kind: 'single' },
    );
  });

  it('a candidate without a party still purges (the SSE event is skipped as missing-party)', async () => {
    const { svc, tx, notifier } = make();
    tx.candidates.create.mockResolvedValue({ id: 'c-new', election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi', party_id: null });
    await svc.create({ ...body, party_id: null } as any);
    expect(notifier.afterCommit).toHaveBeenCalledWith('e1', [], { kind: 'single', skippedMissingParty: { resultId: 'r-new' } });
  });

  it('a failing post-commit step never fails the request', async () => {
    const { svc, notifier } = make();
    notifier.afterCommit.mockRejectedValue(new Error('redis down'));
    await expect(svc.create(body as any)).resolves.toMatchObject({ id: 'c-new' });
  });

  it('writes exactly one CANDIDATE_CREATE audit row inside the transaction, under a savepoint', async () => {
    const { svc, tx, prisma } = make();
    await svc.create(body as any, 'u1');
    expect(tx.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
    expect(tx.audit_logs.create.mock.calls[0][0]).toMatchObject({
      data: { user_id: 'u1', action: 'CANDIDATE_CREATE', entity_type: 'candidate', entity_id: 'c-new', new_value: { name: 'Ravi', party_id: 'BJP' } },
    });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('SAVEPOINT audit_row');
  });

  it('a failing audit insert rolls back to the savepoint and the candidate is still created', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, tx } = make();
    tx.audit_logs.create.mockRejectedValue(new Error('audit insert failed'));
    await expect(svc.create(body as any, 'u1')).resolves.toMatchObject({ id: 'c-new' });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT audit_row');
    warn.mockRestore();
  });
});

describe('CandidatesService update / link audit rows', () => {
  const row = { id: 'c1', name: 'Ravi', party_id: 'BJP', person_id: 'p-old', is_incumbent: false, metadata: { age: 40 }, updated_at: new Date(1) };
  function make() {
    const prisma = {
      candidates: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn(async ({ data }) => ({ ...row, ...data, updated_at: new Date(2) })),
      },
      persons: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-new', photo_url: 'x', gender: 'M', education: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const svc = new CandidatesService(prisma as any, {} as any, new AuditLogService(prisma as any));
    return { svc, prisma };
  }
  const auditData = (prisma: any) => prisma.audit_logs.create.mock.calls.map((c: any) => c[0].data);

  it('update writes one CANDIDATE_UPDATE row with only the changed fields', async () => {
    const { svc, prisma } = make();
    await svc.update('c1', { name: 'Ravi', is_incumbent: true, metadata: { age: 41 } } as any, 'u1');
    expect(auditData(prisma)).toEqual([{
      user_id: 'u1', action: 'CANDIDATE_UPDATE', entity_type: 'candidate', entity_id: 'c1',
      old_value: { is_incumbent: false, metadata: { age: 40 } },
      new_value: { is_incumbent: true, metadata: { age: 41 } },
    }]);
  });

  it('linkPerson writes one CANDIDATE_LINK_PERSON row', async () => {
    const { svc, prisma } = make();
    await svc.linkPerson('c1', 'p-new', 'u1');
    expect(auditData(prisma)).toEqual([expect.objectContaining({
      action: 'CANDIDATE_LINK_PERSON', entity_id: 'c1', old_value: { person_id: 'p-old' }, new_value: { person_id: 'p-new' },
    })]);
  });

  it('unlinkPerson writes one CANDIDATE_UNLINK_PERSON row', async () => {
    const { svc, prisma } = make();
    await svc.unlinkPerson('c1', 'u1');
    expect(auditData(prisma)).toEqual([expect.objectContaining({
      action: 'CANDIDATE_UNLINK_PERSON', entity_id: 'c1', old_value: { person_id: 'p-old' }, new_value: { person_id: null },
    })]);
  });

  it('an audit failure still returns the updated candidate', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.update('c1', { is_incumbent: true } as any, 'u1')).resolves.toMatchObject({ is_incumbent: true });
    await expect(svc.unlinkPerson('c1', 'u1')).resolves.toMatchObject({ person_id: null });
    warn.mockRestore();
  });
});
