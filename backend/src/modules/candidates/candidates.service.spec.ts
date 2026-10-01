import { Logger } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConstituencyNotFoundException, ElectionFinalizedException, ElectionNotFoundException, ErrorCodes } from '../../common/exceptions';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCandidateDto, UpdateCandidateDto } from './dto/candidate-input.dto';

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

  it('linkPerson to the person already linked writes no audit row', async () => {
    const { svc, prisma } = make();
    await expect(svc.linkPerson('c1', 'p-old', 'u1')).resolves.toMatchObject({ person_id: 'p-old' });
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('unlinkPerson writes one CANDIDATE_UNLINK_PERSON row', async () => {
    const { svc, prisma } = make();
    await svc.unlinkPerson('c1', 'u1');
    expect(auditData(prisma)).toEqual([expect.objectContaining({
      action: 'CANDIDATE_UNLINK_PERSON', entity_id: 'c1', old_value: { person_id: 'p-old' }, new_value: { person_id: null },
    })]);
  });

  it('unlinkPerson on a candidate that is already unlinked writes no audit row', async () => {
    const { svc, prisma } = make();
    prisma.candidates.findUnique.mockResolvedValue({ ...row, person_id: null });
    await expect(svc.unlinkPerson('c1', 'u1')).resolves.toMatchObject({ person_id: null });
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
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

describe('CandidatesService.seatResult', () => {
  type Row = { id: string; name: string; party_id: string | null; results: { votes: number | null; status: string; margin: number | null }[] };
  const r = (id: string, party_id: string | null, votes: number | null, status: string, margin: number | null = 0): Row =>
    ({ id, name: `Name ${id}`, party_id, results: [{ votes, status, margin }] });
  function make(seat: Row[], candidate: unknown = { id: 'c2', const_id: 'BR_VS_1', election_id: 'e1', elections: { status: 'Finalized' } }) {
    const prisma = {
      candidates: { findUnique: jest.fn().mockResolvedValue(candidate), findMany: jest.fn().mockResolvedValue(seat) },
    };
    const svc = new CandidatesService(prisma as any, {} as any, {} as any);
    return { svc, prisma };
  }

  it('a seat with votes: share of all votes (NOTA included), rank by votes, NOTA last, loser margin is the gap to the winner', async () => {
    const { svc, prisma } = make([
      r('nota', 'NOTA', 1000, 'LOST'),
      r('c2', 'INC', 30000, 'LOST', 21585),
      r('c1', 'JDU', 51585, 'WON', 21585),
      r('c3', 'BSP', 17415, 'LOST', 21585),
    ]);
    const out = await svc.seatResult('c2');
    expect(prisma.candidates.findMany.mock.calls[0][0].where).toEqual({ const_id: 'BR_VS_1', election_id: 'e1' });
    expect(out.declared).toBe(true);
    expect(out.total_votes).toBe(100000);
    expect(out.seat.map((s) => s.candidate_id)).toEqual(['c1', 'c2', 'c3', 'nota']);
    expect(out.seat[0]).toEqual({
      candidate_id: 'c1', name: 'Name c1', party_id: 'JDU', votes: 51585, share: 51.6, position: 1, status: 'WON', margin: 21585,
    });
    expect(out.candidate).toEqual({
      candidate_id: 'c2', name: 'Name c2', party_id: 'INC', votes: 30000, share: 30, position: 2, status: 'LOST', margin: -21585,
    });
    expect(out.seat[2]).toMatchObject({ position: 3, share: 17.4, margin: -34170 });
    expect(out.seat[3]).toMatchObject({ candidate_id: 'nota', share: 1, position: null, margin: null });
  });

  it('all-zero or missing votes: share null, the winner is position 1 by status, others null, no NaN', async () => {
    const { svc } = make([
      r('c2', 'PMK', 0, 'LOST', 50938),
      { id: 'c3', name: 'Name c3', party_id: 'IND', results: [] },
      r('nota', 'NOTA', null, 'LOST'),
      r('c1', 'DMK', 0, 'WON', 50938),
    ]);
    const out = await svc.seatResult('c2');
    expect(out.total_votes).toBe(0);
    expect(out.seat.map((s) => s.candidate_id)).toEqual(['c1', 'c2', 'c3', 'nota']);
    expect(out.seat[0]).toMatchObject({ position: 1, share: null, margin: 50938, status: 'WON' });
    expect(out.candidate).toMatchObject({ votes: 0, position: null, share: null, margin: null });
    expect(out.seat[2]).toMatchObject({ votes: null, status: null, position: null, share: null, margin: null });
    expect(JSON.stringify(out)).not.toMatch(/NaN|Infinity/);
  });

  it('a seat still counting: LEADING is the reference, declared is false', async () => {
    const { svc } = make(
      [r('c1', 'BJP', 4000, 'LEADING', 1000), r('c2', 'INC', 3000, 'TRAILING', 1000)],
      { id: 'c2', const_id: 'X', election_id: 'e1', elections: { status: 'Live' } },
    );
    const out = await svc.seatResult('c2');
    expect(out.declared).toBe(false);
    expect(out.candidate).toMatchObject({ position: 2, share: 42.9, margin: -1000 });
  });

  it('an unknown candidate is a 404', async () => {
    const { svc } = make([], null);
    const err = await svc.seatResult('nope').catch((e) => e);
    expect(err.getStatus()).toBe(404);
  });
});

describe('Candidate input DTOs', () => {
  it.each([['update', UpdateCandidateDto], ['create', CreateCandidateDto]] as const)('%s maps a blank party_id and person_id to null', async (_, cls) => {
    const body = { election_id: '11111111-1111-1111-1111-111111111111', const_id: 's1', name: 'N', party_id: '', person_id: '' };
    const dto = plainToInstance(cls, body) as unknown as Record<string, unknown>;
    expect(await validate(dto)).toEqual([]);
    expect(dto.party_id).toBeNull();
    expect(dto.person_id).toBeNull();
    expect(dto.name).toBe('N');
  });

  it('update accepts is_incumbent as a boolean and rejects anything else', async () => {
    expect(await validate(plainToInstance(UpdateCandidateDto, { is_incumbent: true }))).toEqual([]);
    expect(await validate(plainToInstance(UpdateCandidateDto, { is_incumbent: false }))).toEqual([]);
    const errors = await validate(plainToInstance(UpdateCandidateDto, { is_incumbent: 'yes' }));
    expect(errors.map((e) => e.property)).toEqual(['is_incumbent']);
  });
});
