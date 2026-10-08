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
