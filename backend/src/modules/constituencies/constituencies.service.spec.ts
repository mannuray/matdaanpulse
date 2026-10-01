import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConstituenciesService } from './constituencies.service';
import { Prisma } from '@prisma/client';
import { ConstituencySummaryDto } from './dto/constituency-response.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateAnalysisDto, UpdateConstituencyDto } from './dto/constituency-input.dto';

const seat = { id: 'BR_VS_1', name: 'Valmiki Nagar', const_no: 1, type: 'GEN', phase: null, district_id: 5, metadata: { tags: ['border'] }, updated_at: new Date(1) };

function make() {
  const prisma: any = {
    constituencies: {
      findUnique: jest.fn().mockResolvedValue(seat),
      findMany: jest.fn().mockResolvedValue([seat, { ...seat, id: 'BR_VS_2', metadata: { tags: ['urban'] } }]),
      update: jest.fn(async ({ where, data }) => ({ ...seat, id: where.id, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)), updated_at: new Date(2) })),
    },
    audit_logs: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const svc = new ConstituenciesService(prisma, {} as any, [], new AuditLogService(prisma));
  return { svc, prisma };
}

describe('ConstituenciesService audit rows', () => {
  it('updateConstituency saves phase and type to the columns and writes one CONSTITUENCY_UPDATE row', async () => {
    const { svc, prisma } = make();
    await svc.updateConstituency('BR_VS_1', { phase: 2, type: 'SC', district_id: 5 }, 'u1');
    expect(prisma.constituencies.update.mock.calls[0][0].data).toMatchObject({ phase: 2, type: 'SC' });
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'CONSTITUENCY_UPDATE', entity_type: 'constituency', entity_id: 'BR_VS_1',
      old_value: { phase: null, type: 'GEN' }, new_value: { phase: 2, type: 'SC' },
    });
  });

  it('updateMetadata writes one row with the changed metadata keys', async () => {
    const { svc, prisma } = make();
    await svc.updateMetadata('BR_VS_1', { literacy: 61.8 }, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toMatchObject({
      action: 'CONSTITUENCY_UPDATE', old_value: { metadata: { literacy: null } }, new_value: { metadata: { literacy: 61.8 } },
    });
  });

  it('metadata.phase is ignored (the phase column is canonical): a phase-only patch saves with no row', async () => {
    const { svc, prisma } = make();
    await expect(svc.updateMetadata('BR_VS_1', { phase: '3' }, 'u1')).resolves.toMatchObject({ id: 'BR_VS_1', phase: null });
    expect(prisma.constituencies.update.mock.calls[0][0].data.metadata).toEqual({ tags: ['border'] });
    await svc.updateConstituency('BR_VS_1', { metadata: { phase: '3', literacy: 61.8 } }, 'u1');
    expect(prisma.constituencies.update.mock.calls[1][0].data).toMatchObject({ phase: undefined, metadata: { tags: ['border'], literacy: 61.8 } });
    expect(prisma.constituencies.update.mock.calls[1][0].data.metadata).not.toHaveProperty('phase');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data.new_value).toEqual({ metadata: { literacy: 61.8 } });
  });

  it('bulkTag writes one row per seat whose tags changed, in one insert', async () => {
    const { svc, prisma } = make();
    await svc.bulkTag(['BR_VS_1', 'BR_VS_2'], ['border'], [], 'u1');
    expect(prisma.audit_logs.createMany).toHaveBeenCalledTimes(1);
    const rows = prisma.audit_logs.createMany.mock.calls[0][0].data;
    expect(rows).toEqual([expect.objectContaining({
      action: 'CONSTITUENCY_UPDATE', entity_id: 'BR_VS_2',
      old_value: { metadata: { tags: ['urban'] } }, new_value: { metadata: { tags: ['urban', 'border'] } },
    })]);
  });

  it('an audit failure still returns the saved seat', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.updateConstituency('BR_VS_1', { phase: 3 }, 'u1')).resolves.toMatchObject({ phase: 3 });
    warn.mockRestore();
  });
});

describe('UpdateConstituencyDto', () => {
  const errorsFor = async (body: object) => (await validate(plainToInstance(UpdateConstituencyDto, body))).map((e) => e.property);
  it('accepts phase (or null) and GEN / SC / ST', async () => {
    expect(await errorsFor({ phase: 4, type: 'ST' })).toEqual([]);
    expect(await errorsFor({ phase: null })).toEqual([]);
    expect(await errorsFor({ phase: 20 })).toEqual([]);
  });
  it('rejects a bad phase or reservation, and a null reservation', async () => {
    expect(await errorsFor({ phase: 0 })).toContain('phase');
    expect(await errorsFor({ phase: 21 })).toContain('phase');
    expect(await errorsFor({ type: 'OBC' })).toContain('type');
    expect(await errorsFor({ type: null })).toContain('type');
  });
});

describe('UpdateAnalysisDto', () => {
  it('an emptied text field is saved as null, not \'\'', async () => {
    const dto = plainToInstance(UpdateAnalysisDto, { dominance: '', dominance_party: '', notes: '' });
    expect(dto).toMatchObject({ dominance: null, dominance_party: null, notes: null });
    expect(await validate(dto)).toEqual([]);
  });
});

describe('ConstituenciesService.findOneWithAnalysis', () => {
  it('includes the state, so the record page can show its code', async () => {
    const prisma: any = {
      constituencies: { findUnique: jest.fn().mockResolvedValue({ ...seat, election_id: 'e1', districts: null, regions: null, elections: {}, states: { id: 5, code: 'BR', name: 'Bihar' } }) },
      constituency_analysis: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const svc = new ConstituenciesService(prisma, {} as any, [], {} as any);
    const out = await svc.findOneWithAnalysis('BR_VS_1');
    expect(prisma.constituencies.findUnique.mock.calls[0][0].include).toMatchObject({ states: true });
    expect(out.state).toEqual({ id: 5, code: 'BR', name: 'Bihar' });
  });
});

describe('ConstituenciesService.history', () => {
  const win = (name: string, party_id: string, margin: number | null, status = 'WON') => ({ status, margin, candidates: { name, party_id } });
  const match = (id: string, year: number, results: unknown[], voter_turnout: unknown = null) =>
    ({ id, election_id: `e${year}`, voter_turnout, elections: { year, type: 'VS' }, results });
  function make(seat: unknown, matches: unknown[]) {
    const prisma: any = {
      constituencies: { findUnique: jest.fn().mockResolvedValue(seat), findMany: jest.fn().mockResolvedValue(matches) },
    };
    return { svc: new ConstituenciesService(prisma, {} as any, [], {} as any), prisma };
  }
  const current = { id: 'BR_VS_1_VALMIKI_NAGAR', state_id: 5, const_no: 1, elections: { type: 'VS' } };

  it('matches on state, election type and const_no; newest first; one party change across 3 elections', async () => {
    const { svc, prisma } = make(current, [
      match('BR_VS10_1_VALMIKI_NAGAR', 2010, [win('A', 'JDU', 1200)], { toString: () => '58.40', valueOf: () => 58.4 }),
      match('BR_VS_1_VALMIKI_NAGAR', 2025, [win('C', 'BJP', 900, 'LEADING'), win('X', 'INC', 5, 'WON')]),
      match('BR_VS15_1_VALMIKI_NAGAR', 2015, [win('B', 'JDU', null)]),
    ]);
    const out = await svc.history('BR_VS_1_VALMIKI_NAGAR');
    expect(prisma.constituencies.findMany.mock.calls[0][0].where).toEqual({ state_id: 5, const_no: 1, elections: { type: 'VS' } });
    expect(out.rows.map((r) => r.year)).toEqual([2025, 2015, 2010]);
    expect(out.rows[0]).toEqual({
      election_id: 'e2025', year: 2025, type: 'VS', winner: 'X', party_id: 'INC', margin: 5, turnout: null, is_current: true,
    });
    expect(out.rows[2]).toMatchObject({ winner: 'A', party_id: 'JDU', margin: 1200, turnout: 58.4, is_current: false });
    expect(out.volatility).toEqual({ elections: 3, changes: 1 });
  });

  it('a seat with no result yet has winner null and is left out of the volatility count', async () => {
    const { svc } = make(current, [match('BR_VS_1_VALMIKI_NAGAR', 2025, []), match('BR_VS20_1_VALMIKI_NAGAR', 2020, [win('A', 'JDU', 10)])]);
    const out = await svc.history('BR_VS_1_VALMIKI_NAGAR');
    expect(out.rows[0]).toMatchObject({ winner: null, party_id: null, margin: null, is_current: true });
    expect(out.volatility).toEqual({ elections: 1, changes: 0 });
  });

  it('an id that does not parse still resolves through its columns; with no state it returns only the current seat', async () => {
    const { svc, prisma } = make({ id: 'WEIRD', state_id: null, const_no: 7, elections: { type: 'LS' } }, [match('WEIRD', 2024, [])]);
    const out = await svc.history('WEIRD');
    expect(prisma.constituencies.findMany.mock.calls[0][0].where).toEqual({ id: 'WEIRD' });
    expect(out).toEqual({ volatility: { elections: 0, changes: 0 }, rows: [expect.objectContaining({ is_current: true, winner: null })] });
  });

  it('an unknown id is a 404, not a 500', async () => {
    const { svc } = make(null, []);
    const err = await svc.history('NOPE').catch((e) => e);
    expect(err.getStatus()).toBe(404);
  });
});

describe('ConstituencySummaryDto', () => {
  it('maps a Prisma Decimal turnout to a number (it used to throw DecimalError, a 500 on GET /constituencies)', () => {
    const map = (v: unknown) => plainToInstance(ConstituencySummaryDto, { id: 'ADILABAD', voter_turnout: v }, { excludeExtraneousValues: true });
    expect(map(new Prisma.Decimal('65.28')).voter_turnout).toBe(65.28);
    expect(map(null).voter_turnout).toBeNull();
  });
});
