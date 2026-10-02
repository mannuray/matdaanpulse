import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConstituencyNotFoundException, ElectionFinalizedException, ElectionNotFoundException, ErrorCodes } from '../../common/exceptions';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCandidateDto, UpdateCandidateDto } from './dto/candidate-input.dto';

describe('CandidatesService.personContests', () => {
  const make = (rows: unknown[]) => {
    const prisma = { candidates: { findMany: jest.fn().mockResolvedValue(rows) } };
    return { svc: new CandidatesService(prisma as any, {} as any, new AuditLogService(prisma as any)), prisma };
  };

  it('counts every contest of the person and takes the earliest election year', async () => {
    const { svc, prisma } = make([{ elections: { year: 2020 } }, { elections: { year: 2010 } }, { elections: { year: 2025 } }]);
    await expect(svc.personContests('p1')).resolves.toEqual({ contests: 3, first_year: 2010 });
    expect(prisma.candidates.findMany).toHaveBeenCalledWith({ where: { person_id: 'p1' }, select: { elections: { select: { year: true } } } });
  });

  it('is 0 contests with no first year for a person with no candidacies', async () => {
    await expect(make([]).svc.personContests('p1')).resolves.toEqual({ contests: 0, first_year: null });
  });
});

describe('CandidatesService.create', () => {
  function make(seat: unknown = { id: 'BR_VS_1', election_id: 'e1', state_id: 10 }, election: unknown = { status: 'Live' }) {
    const order: string[] = [];
    const tx = {
      elections: { findUnique: jest.fn().mockResolvedValue(election) },
      constituencies: { findFirst: jest.fn().mockResolvedValue(seat) },
      persons: { create: jest.fn().mockResolvedValue({ id: 'p-auto' }) },
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

  const body = { election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi', party_id: 'BJP', age: 40 };

  it('checks the seat belongs to the election, then creates the candidate and its results row in one transaction', async () => {
    const { svc, tx, prisma } = make();
    await expect(svc.create(body as any)).resolves.toMatchObject({ id: 'c-new' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.constituencies.findFirst).toHaveBeenCalledWith({ where: { id: 'BR_VS_1', election_id: 'e1' }, select: { id: true, state_id: true } });
    // No person given: one is created from the ballot name and the seat's state.
    expect(tx.persons.create).toHaveBeenCalledWith({ data: { name: 'Ravi', state_id: 10 }, select: { id: true } });
    expect(tx.candidates.create).toHaveBeenCalledWith({ data: { ...body, person_id: 'p-auto' } });
    expect(tx.results.create).toHaveBeenCalledWith({
      data: { candidate_id: 'c-new', const_id: 'BR_VS_1', election_id: 'e1', votes: 0, status: 'TRAILING', margin: 0 },
    });
    // Nothing is written outside the transaction.
    expect(prisma.candidates.create).not.toHaveBeenCalled();
    expect(prisma.results.create).not.toHaveBeenCalled();
  });

  it('a candidate created with a person creates no person', async () => {
    const { svc, tx } = make();
    (tx.persons as any).findUnique = jest.fn().mockResolvedValue({ id: 'p1' });
    await svc.create({ ...body, person_id: 'p1' } as any);
    expect(tx.persons.create).not.toHaveBeenCalled();
    expect(tx.candidates.create).toHaveBeenCalledWith({ data: expect.objectContaining({ person_id: 'p1' }) });
  });

  it('a candidate created with an unknown person is a 404 and writes nothing', async () => {
    const { svc, tx } = make();
    (tx.persons as any).findUnique = jest.fn().mockResolvedValue(null);
    const err = await svc.create({ ...body, person_id: 'p-gone' } as any).catch((e) => e);
    expect(err.getStatus()).toBe(404);
    expect(tx.candidates.create).not.toHaveBeenCalled();
  });

  it('assets set on create: the CANDIDATE_CREATE audit row carries it as a number and the create is not rolled back', async () => {
    const { svc, tx } = make();
    tx.candidates.create.mockResolvedValue({ id: 'c-new', election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi', party_id: 'BJP', assets: BigInt(12500000) } as any);
    await expect(svc.create({ ...body, assets: 12500000 } as any, 'u1')).resolves.toMatchObject({ id: 'c-new' });
    expect(tx.audit_logs.create.mock.calls[0][0].data.new_value).toMatchObject({ assets: 12500000 });
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

describe('CandidatesService.update audit rows', () => {
  const row = { id: 'c1', name: 'Ravi', party_id: 'BJP', person_id: 'p-old', is_incumbent: false, assets: null, updated_at: new Date(1) };
  function make() {
    const prisma = {
      candidates: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn(async ({ data }) => ({
          ...row, ...data, ...(data.assets != null && { assets: BigInt(data.assets) }), updated_at: new Date(2),
        })),
      },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const svc = new CandidatesService(prisma as any, {} as any, new AuditLogService(prisma as any));
    return { svc, prisma };
  }
  const auditData = (prisma: any) => prisma.audit_logs.create.mock.calls.map((c: any) => c[0].data);

  it('update writes one CANDIDATE_UPDATE row with only the changed fields', async () => {
    const { svc, prisma } = make();
    await svc.update('c1', { name: 'Ravi', is_incumbent: true } as any, 'u1');
    expect(auditData(prisma)).toEqual([{
      user_id: 'u1', action: 'CANDIDATE_UPDATE', entity_type: 'candidate', entity_id: 'c1',
      old_value: { is_incumbent: false },
      new_value: { is_incumbent: true },
    }]);
  });

  it('an assets change (a BigInt column) is audited as plain numbers', async () => {
    const { svc, prisma } = make();
    const updated = await svc.update('c1', { assets: 4200000000 } as any, 'u1');
    expect(updated.assets).toBe(BigInt(4200000000));
    expect(auditData(prisma)).toEqual([expect.objectContaining({ old_value: { assets: null }, new_value: { assets: 4200000000 } })]);
  });

  it('an audit failure still returns the updated candidate', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.update('c1', { is_incumbent: true } as any, 'u1')).resolves.toMatchObject({ is_incumbent: true });
    warn.mockRestore();
  });
});

describe('CandidatesService.changePerson / split', () => {
  const candidate = { id: 'c1', name: 'RAVI KUMAR', person_id: 'p-old', constituencies: { state_id: 10 } };
  const oldPerson = { id: 'p-old', name: 'Ravi Kumar', gender: 'M', date_of_birth: new Date('1970-01-02'), updated_at: new Date(1) };
  /** `oldPersonGone`: the orphan trigger deleted p-old when the candidate moved (it was its only contest). */
  function make({ oldPersonGone = false, target = { id: 'p-new' } as unknown } = {}) {
    let moved = false;
    const tx = {
      candidates: {
        findUnique: jest.fn().mockResolvedValue(candidate),
        update: jest.fn(async ({ data }) => { moved = true; return { ...candidate, ...data }; }),
      },
      persons: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === 'p-old') return moved && oldPersonGone ? null : oldPerson;
          return where.id === 'p-new' ? target : null;
        }),
        create: jest.fn().mockResolvedValue({ id: 'p-split' }),
      },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)), audit_logs: { create: jest.fn() } };
    const svc = new CandidatesService(prisma as any, {} as any, new AuditLogService(prisma as any));
    const audit = () => tx.audit_logs.create.mock.calls.map((c: any) => c[0].data);
    return { svc, tx, prisma, audit };
  }

  it('change person moves the candidacy and writes CANDIDATE_LINK_PERSON, in one transaction', async () => {
    const { svc, tx, prisma, audit } = make();
    await expect(svc.changePerson('c1', 'p-new', 'u1')).resolves.toMatchObject({ person_id: 'p-new', old_person_deleted: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.candidates.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { person_id: 'p-new' } });
    expect(audit()).toEqual([{
      user_id: 'u1', action: 'CANDIDATE_LINK_PERSON', entity_type: 'candidate', entity_id: 'c1',
      old_value: { person_id: 'p-old' }, new_value: { person_id: 'p-new' },
    }]);
  });

  it('change person that empties the old person also writes PERSON_DELETE with its snapshot (taken before the move)', async () => {
    const { svc, audit } = make({ oldPersonGone: true });
    await expect(svc.changePerson('c1', 'p-new', 'u1')).resolves.toMatchObject({ old_person_deleted: true });
    expect(audit().map((a: any) => a.action)).toEqual(['CANDIDATE_LINK_PERSON', 'PERSON_DELETE']);
    expect(audit()[1]).toMatchObject({
      entity_type: 'person', entity_id: 'p-old',
      old_value: { id: 'p-old', name: 'Ravi Kumar', gender: 'M', date_of_birth: '1970-01-02T00:00:00.000Z' },
    });
  });

  it('change person to the same person is a no-op with no audit row', async () => {
    const { svc, tx, audit } = make();
    await expect(svc.changePerson('c1', 'p-old', 'u1')).resolves.toMatchObject({ person_id: 'p-old' });
    expect(tx.candidates.update).not.toHaveBeenCalled();
    expect(audit()).toEqual([]);
  });

  it('change person to an unknown person is a 404 and moves nothing', async () => {
    const { svc, tx } = make({ target: null });
    const err = await svc.changePerson('c1', 'p-new', 'u1').catch((e) => e);
    expect(err.getStatus()).toBe(404);
    expect(tx.candidates.update).not.toHaveBeenCalled();
  });

  it('change person or split of an unknown candidate is a 404', async () => {
    const { svc, tx } = make();
    tx.candidates.findUnique.mockResolvedValue(null);
    expect((await svc.changePerson('nope', 'p-new').catch((e) => e)).getStatus()).toBe(404);
    expect((await svc.split('nope').catch((e) => e)).getStatus()).toBe(404);
  });

  it('split creates a person from the ballot name and the seat state, moves the candidacy and writes CANDIDATE_SPLIT', async () => {
    const { svc, tx, audit } = make();
    await expect(svc.split('c1', 'u1')).resolves.toEqual({ person_id: 'p-split', old_person_deleted: false });
    expect(tx.persons.create).toHaveBeenCalledWith({ data: { name: 'RAVI KUMAR', state_id: 10 }, select: { id: true } });
    expect(tx.candidates.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { person_id: 'p-split' } });
    expect(audit()).toEqual([expect.objectContaining({
      action: 'CANDIDATE_SPLIT', entity_id: 'c1', old_value: { person_id: 'p-old' }, new_value: { person_id: 'p-split' },
    })]);
  });

  it('split that empties the old person also writes PERSON_DELETE', async () => {
    const { svc, audit } = make({ oldPersonGone: true });
    await expect(svc.split('c1', 'u1')).resolves.toEqual({ person_id: 'p-split', old_person_deleted: true });
    expect(audit().map((a: any) => [a.action, a.entity_id])).toEqual([['CANDIDATE_SPLIT', 'c1'], ['PERSON_DELETE', 'p-old']]);
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
  it('create maps a blank party_id and person_id to null', async () => {
    const body = { election_id: '11111111-1111-1111-1111-111111111111', const_id: 's1', name: 'N', party_id: '', person_id: '' };
    const dto = plainToInstance(CreateCandidateDto, body) as unknown as Record<string, unknown>;
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

  const AFFIDAVIT = ['age', 'assets', 'liabilities', 'criminal_cases'];

  it.each([['update', UpdateCandidateDto], ['create', CreateCandidateDto]] as const)('%s: affidavit fields are whole numbers ≥ 0; blank is null, 0 stays 0', async (_, cls) => {
    const base = { election_id: '11111111-1111-1111-1111-111111111111', const_id: 's1', name: 'N' };
    const ok = plainToInstance(cls, { ...base, age: 0, assets: 125000000000, liabilities: '', criminal_cases: 3 }) as unknown as Record<string, unknown>;
    expect(await validate(ok)).toEqual([]);
    expect(ok).toMatchObject({ age: 0, assets: 125000000000, liabilities: null, criminal_cases: 3 });
    for (const bad of [-1, 1.5, '12', 1e20]) {
      const errors = await validate(plainToInstance(cls, { ...base, ...Object.fromEntries(AFFIDAVIT.map((k) => [k, bad])) }));
      expect(errors.map((e) => e.property).sort()).toEqual([...AFFIDAVIT].sort());
    }
    // SMALLINT columns.
    const big = await validate(plainToInstance(cls, { ...base, age: 40000, criminal_cases: 40000, assets: 40000 }));
    expect(big.map((e) => e.property).sort()).toEqual(['age', 'criminal_cases']);
  });
});

describe('Candidate input DTOs through the ValidationPipe (whitelist + forbidNonWhitelisted)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const body = (metatype: any, value: Record<string, unknown>) => pipe.transform(value, { type: 'body', metatype });

  it.each(['metadata', 'gender', 'education', 'person_id'])('update rejects %s (no longer a candidate field to edit)', async (field) => {
    await expect(body(UpdateCandidateDto, { [field]: field === 'metadata' ? {} : 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
