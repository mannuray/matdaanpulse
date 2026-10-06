import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PartiesService } from './parties.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePartyDto, UpdatePartyDto } from './dto/party-input.dto';
import { PartiesQueryDto } from '../../common/dto/query.dto';

const BJP = { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF9933', leader_name: 'A', eci_recognition: null, updated_at: new Date(1) };

function make(over: Record<string, unknown> = {}) {
  const prisma = {
    parties: {
      findUnique: jest.fn().mockResolvedValue(BJP),
      create: jest.fn(async ({ data }) => ({ ...data, color: data.color ?? null, updated_at: new Date(2) })),
      update: jest.fn(async ({ data }) => ({ ...BJP, ...data, updated_at: new Date(2) })),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
    ...over,
  };
  const audit = new AuditLogService(prisma as any);
  const svc = new PartiesService(prisma as any, audit);
  return { svc, prisma };
}

describe('PartiesService audit rows', () => {
  it('create writes exactly one PARTY_CREATE row with the new fields', async () => {
    const { svc, prisma } = make();
    await svc.create({ id: 'XYZ', name: 'X party', eci_recognition: 'State' } as any, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toMatchObject({
      user_id: 'u1', action: 'PARTY_CREATE', entity_type: 'party', entity_id: 'XYZ',
      new_value: { id: 'XYZ', name: 'X party', eci_recognition: 'State' },
    });
  });

  it('update writes exactly one PARTY_UPDATE row with only the changed fields', async () => {
    const { svc, prisma } = make();
    await svc.update('BJP', { name: 'Bharatiya Janata Party', leader_name: 'B', eci_recognition: 'National' } as any, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'PARTY_UPDATE', entity_type: 'party', entity_id: 'BJP',
      old_value: { leader_name: 'A', eci_recognition: null },
      new_value: { leader_name: 'B', eci_recognition: 'National' },
    });
  });

  it('an update that changes nothing writes no audit row', async () => {
    const { svc, prisma } = make();
    await svc.update('BJP', { name: BJP.name } as any, 'u1');
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('an audit failure still returns the saved party', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('audit table locked'));
    await expect(svc.update('BJP', { leader_name: 'B' } as any, 'u1')).resolves.toMatchObject({ id: 'BJP', leader_name: 'B' });
    await expect(svc.create({ id: 'XYZ', name: 'X' } as any, 'u1')).resolves.toMatchObject({ id: 'XYZ' });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('PartiesService.findPaginated eci_recognition filter', () => {
  it('National filters on the value', async () => {
    const { svc, prisma } = make();
    await svc.findPaginated(1, 25, undefined, undefined, undefined, 'National');
    expect(prisma.parties.findMany.mock.calls[0][0].where).toEqual({ eci_recognition: 'National' });
    expect(prisma.parties.count.mock.calls[0][0].where).toEqual({ eci_recognition: 'National' });
  });

  it('none filters on NULL', async () => {
    const { svc, prisma } = make();
    await svc.findPaginated(1, 25, 'janata', undefined, undefined, 'none');
    expect(prisma.parties.findMany.mock.calls[0][0].where).toMatchObject({ eci_recognition: null, OR: expect.any(Array) });
  });

  it('no filter leaves the column alone', async () => {
    const { svc, prisma } = make();
    await svc.findPaginated(1, 25);
    expect(prisma.parties.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe('party DTOs: eci_recognition', () => {
  const errorsFor = async (cls: any, body: object) =>
    (await validate(plainToInstance(cls, body) as object)).map((e) => e.property);

  it('rejects an unknown value', async () => {
    expect(await errorsFor(UpdatePartyDto, { eci_recognition: 'Foo' })).toContain('eci_recognition');
    expect(await errorsFor(CreatePartyDto, { id: 'X', name: 'X', eci_recognition: 'Foo' })).toContain('eci_recognition');
  });

  it('accepts National / State / Unrecognised and null (not set)', async () => {
    for (const v of ['National', 'State', 'Unrecognised', null]) {
      expect(await errorsFor(UpdatePartyDto, { eci_recognition: v })).toEqual([]);
    }
  });

  it('list query accepts National and none, rejects anything else', async () => {
    expect(await errorsFor(PartiesQueryDto, { eci_recognition: 'National' })).toEqual([]);
    expect(await errorsFor(PartiesQueryDto, { eci_recognition: 'none' })).toEqual([]);
    expect(await errorsFor(PartiesQueryDto, { eci_recognition: 'Foo' })).toContain('eci_recognition');
  });
});

describe('party DTOs: empty strings', () => {
  const NULLABLE = ['abbreviation', 'leader_name', 'headquarters', 'description', 'website', 'wikipedia_url', 'symbol_url', 'eci_symbol_url'];

  it("'' becomes null for every nullable text field, on update and create", async () => {
    const blank = Object.fromEntries(NULLABLE.map((k) => [k, '']));
    const update = plainToInstance(UpdatePartyDto, blank) as unknown as Record<string, unknown>;
    expect(await validate(update)).toEqual([]);
    const create = plainToInstance(CreatePartyDto, { id: 'X', name: 'X', ...blank }) as unknown as Record<string, unknown>;
    expect(await validate(create)).toEqual([]);
    for (const k of NULLABLE) {
      expect(update[k]).toBeNull();
      expect(create[k]).toBeNull();
    }
  });

  it('changing only ECI recognition, in a full admin form with blank fields, audits only eci_recognition', async () => {
    const { svc, prisma } = make();
    const body = {
      name: BJP.name, color: BJP.color, leader_name: 'A', eci_recognition: 'State',
      ...Object.fromEntries(NULLABLE.filter((k) => k !== 'leader_name').map((k) => [k, ''])),
    };
    const dto = plainToInstance(UpdatePartyDto, body);
    expect(await validate(dto)).toEqual([]);
    await svc.update('BJP', dto, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    const row = prisma.audit_logs.create.mock.calls[0][0].data;
    expect(row.old_value).toEqual({ eci_recognition: null });
    expect(row.new_value).toEqual({ eci_recognition: 'State' });
  });
});

describe('PartiesService.usage', () => {
  const elections = [
    { id: 'e-ls24', name: 'Lok Sabha 2024', type: 'LS', year: 2024 },
    { id: 'e-br20', name: 'Bihar Vidhan Sabha 2020', type: 'VS', year: 2020 },
    { id: 'e-br25', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025 },
  ];
  function makeUsage(party: unknown = { id: 'BJP' }) {
    return make({
      parties: { findUnique: jest.fn().mockResolvedValue(party) },
      candidates: {
        groupBy: jest.fn().mockResolvedValue([
          { election_id: 'e-ls24', _count: { _all: 441 } },
          { election_id: 'e-br20', _count: { _all: 110 } },
          { election_id: 'e-br25', _count: { _all: 101 } },
        ]),
      },
      results: {
        groupBy: jest.fn().mockResolvedValue([
          { election_id: 'e-ls24', _count: { _all: 240 } },
          { election_id: 'e-br25', _count: { _all: 89 } },
        ]),
      },
      elections: { findMany: jest.fn().mockResolvedValue(elections) },
    });
  }

  it('returns totals and per-election candidates and wins (WON only), newest year first', async () => {
    const { svc, prisma } = makeUsage();
    const out = await svc.usage('BJP');
    expect(out.totals).toEqual({ candidates: 652, elections: 3, wins: 329 });
    expect(out.elections).toEqual([
      { election_id: 'e-br25', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, candidates: 101, wins: 89 },
      { election_id: 'e-ls24', name: 'Lok Sabha 2024', type: 'LS', year: 2024, candidates: 441, wins: 240 },
      { election_id: 'e-br20', name: 'Bihar Vidhan Sabha 2020', type: 'VS', year: 2020, candidates: 110, wins: 0 },
    ]);
    expect((prisma as any).results.groupBy.mock.calls[0][0].where).toEqual({ status: 'WON', candidates: { party_id: 'BJP' } });
    expect((prisma as any).candidates.groupBy.mock.calls[0][0].where).toEqual({ party_id: 'BJP' });
  });

  it('a party with no candidates has zero totals and no rows', async () => {
    const { svc, prisma } = makeUsage();
    (prisma as any).candidates.groupBy.mockResolvedValue([]);
    (prisma as any).results.groupBy.mockResolvedValue([]);
    (prisma as any).elections.findMany.mockResolvedValue([]);
    await expect(svc.usage('BJP')).resolves.toEqual({ totals: { candidates: 0, elections: 0, wins: 0 }, elections: [] });
  });

  it('an unknown party is a 404', async () => {
    const { svc } = makeUsage(null);
    const err = await svc.usage('NOPE').catch((e) => e);
    expect(err.getStatus()).toBe(404);
  });
});

describe('PartiesService.findAll', () => {
  it('returns every party, not a capped page (the public party lookup needs all of them; 788 after the 2011+ seeds)', async () => {
    const { svc, prisma } = make();
    await svc.findAll();
    expect(prisma.parties.findMany.mock.calls[0][0]).not.toHaveProperty('take');
  });
});

describe('PartiesService lineage and state units (migration 023)', () => {
  const lineageRow = { id: 1, party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: new Date('2022-10-10'), state_id: null, is_successor: false, note: 'n', source_url: 's' };
  it('findLineage returns every event, oldest first', async () => {
    const findMany = jest.fn().mockResolvedValue([lineageRow]);
    const { svc } = make({ party_lineage: { findMany } });
    expect(await svc.findLineage()).toEqual([{ party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false, note: 'n' }]);
    expect(findMany.mock.calls[0][0]).toMatchObject({ orderBy: [{ effective_date: 'asc' }, { id: 'asc' }] });
  });
  it('findOne adds the state units (current roles first) and the lineage on both sides', async () => {
    const unit = { party_id: 'BJP', state_id: 5, eci_recognition: 'National', office: 'Patna', website: null, states: { name: 'Bihar' },
      roles: [{ role: 'state_president', person_id: null, person_name: 'Old', from_date: new Date('2020-01-01'), to_date: new Date('2023-03-01') },
              { role: 'state_president', person_id: 'p1', person_name: 'New', from_date: new Date('2023-03-01'), to_date: null }] };
    const { svc } = make({ party_units: { findMany: jest.fn().mockResolvedValue([unit]) }, party_lineage: { findMany: jest.fn().mockResolvedValue([lineageRow]) } });
    const p = await svc.findOne('BJP');
    expect(p.units).toEqual([{ state_id: 5, state_name: 'Bihar', eci_recognition: 'National', office: 'Patna', website: null,
      roles: [{ role: 'state_president', person_id: 'p1', person_name: 'New', from_date: '2023-03-01', to_date: null },
              { role: 'state_president', person_id: null, person_name: 'Old', from_date: '2020-01-01', to_date: '2023-03-01' }] }]);
    expect(p.lineage).toHaveLength(1);
  });
});
