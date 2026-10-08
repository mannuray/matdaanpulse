import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AdminPersonsQueryDto, AuditLogsQueryDto, CandidatesQueryDto, ConstituencySearchQueryDto,
  ElectionsQueryDto, PartiesQueryDto, PartyRecordQueryDto, PersonSearchQueryDto,
} from './query.dto';

// Same options as main.ts / app.setup.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (metatype: any, value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'query', metatype });

describe('query DTOs', () => {
  it('rejects ?page=abc and ?limit=100000 with 400', async () => {
    await expect(validate(PartiesQueryDto, { page: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(PartiesQueryDto, { limit: '100000' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(PartiesQueryDto, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(AdminPersonsQueryDto, { limit: '2000' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converts valid pagination to numbers', async () => {
    await expect(validate(PartiesQueryDto, { page: '2', limit: '25', q: 'bjp' })).resolves.toMatchObject({ page: 2, limit: 25, q: 'bjp' });
  });

  it('validates election enums, ids and numbers', async () => {
    await expect(validate(ElectionsQueryDto, { type: 'XYZ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(ElectionsQueryDto, { status: 'Live', type: 'VS', year: '2025', state_id: '5' }))
      .resolves.toMatchObject({ status: 'Live', type: 'VS', year: 2025, state_id: 5 });
    await expect(validate(CandidatesQueryDto, { election_id: 'abc', const_id: 'BR_VS_1_x' })).rejects.toBeInstanceOf(BadRequestException);
    // Seed election ids are not RFC-versioned UUIDs; they must still pass.
    await expect(validate(CandidatesQueryDto, { election_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', const_id: 'BR_VS_1_x' }))
      .resolves.toBeDefined();
    // Bihar 2025 (version nibble 9): rejected by class-validator's @IsUUID, must pass here.
    await expect(validate(CandidatesQueryDto, { election_id: 'c3d4e5f6-a7b8-9012-cdef-234567890abc', const_id: 'BR_VS_1_x' })).resolves.toBeDefined();
    await expect(validate(CandidatesQueryDto, { election_id: 'c3d4e5f6-a7b8-9012-cdef-234567890abcX', const_id: 'BR_VS_1_x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(ConstituencySearchQueryDto, { q: 'pat', district_id: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates audit-log dates', async () => {
    await expect(validate(AuditLogsQueryDto, { from: 'garbage' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(AuditLogsQueryDto, { from: '2026-09-01', to: '2026-09-30T23:59:59Z' })).resolves.toBeDefined();
  });

  it('rejects undeclared params', async () => {
    await expect(validate(ElectionsQueryDto, { foo: '1' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('empty query params mean "not sent"', () => {
  it.each([
    [ElectionsQueryDto, { type: '', status: '', state_id: '', year: '' }],
    [PartiesQueryDto, { page: '', limit: '', q: '', election_id: '', state_id: '' }],
    [ConstituencySearchQueryDto, { q: '', election_id: '', district_id: '' }],
    [AdminPersonsQueryDto, { q: '', page: '', limit: '', state_id: '', region_id: '' }],
    [AuditLogsQueryDto, { user_id: '', action: '', entity_type: '', from: '', to: '' }],
  ])('%p accepts empty values as undefined', async (metatype, value) => {
    const out: Record<string, unknown> = await validate(metatype, value as Record<string, string>);
    expect(Object.values(out).every((v) => v === undefined)).toBe(true);
  });
});

describe('tier 3 query validation', () => {
  const bad = (metatype: any, value: Record<string, unknown>) => expect(validate(metatype, value)).rejects.toBeInstanceOf(BadRequestException);

  it('candidate lists need a seat (const_id): never an arbitrary slice of an election', async () => {
    await bad(CandidatesQueryDto, {});
    await bad(CandidatesQueryDto, { election_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' });
    await bad(CandidatesQueryDto, { const_id: '' });
    await expect(validate(CandidatesQueryDto, { const_id: 'AS_VS16_29_KOKRAJHAR_WEST', election_id: '' }))
      .resolves.toMatchObject({ const_id: 'AS_VS16_29_KOKRAJHAR_WEST', election_id: undefined });
    // Real ids carry & (e.g. ..._DAMAN_&_DIU).
    await expect(validate(CandidatesQueryDto, { const_id: 'DD_LS_1_DAMAN_&_DIU' })).resolves.toBeDefined();
    await bad(CandidatesQueryDto, { const_id: 'BR VS 1' });
    await bad(CandidatesQueryDto, { const_id: 'X'.repeat(101) });
  });

  it('an array for a scalar param is a 400, not a Prisma error', async () => {
    await bad(CandidatesQueryDto, { const_id: ['BR_VS_1_X', 'BR_VS_2_Y'] });
    await bad(CandidatesQueryDto, { const_id: 'BR_VS_1_X', election_id: ['b2c3d4e5-f6a7-8901-bcde-f12345678901'] });
    await bad(PersonSearchQueryDto, { q: ['nitish', 'kumar'] });
    await bad(PartyRecordQueryDto, { state: ['BR', 'WB'] });
    await bad(AuditLogsQueryDto, { action: ['A', 'B'] });
  });

  it('person search: q is required, trimmed, at most 100 chars', async () => {
    await bad(PersonSearchQueryDto, {});
    await bad(PersonSearchQueryDto, { q: 'x'.repeat(101) });
    await expect(validate(PersonSearchQueryDto, { q: '  nitish ' })).resolves.toMatchObject({ q: 'nitish' });
    // Short (after trimming) is valid input; the controller answers [] (the admin picker sends ≥ 2 untrimmed chars).
    await expect(validate(PersonSearchQueryDto, { q: ' a' })).resolves.toMatchObject({ q: 'a' });
  });

  it('party record ?state= is a 2-letter state code (any case) or absent', async () => {
    expect(((await validate(PartyRecordQueryDto, {})) as PartyRecordQueryDto).state).toBeUndefined();
    await expect(validate(PartyRecordQueryDto, { state: '' })).resolves.toMatchObject({ state: undefined });
    await expect(validate(PartyRecordQueryDto, { state: 'br' })).resolves.toMatchObject({ state: 'br' });
    await expect(validate(PartyRecordQueryDto, { state: 'WB' })).resolves.toMatchObject({ state: 'WB' });
    for (const state of ['BRX', 'B', '1A', 'B-', 'Bihar']) await bad(PartyRecordQueryDto, { state });
  });

  it('audit logs take optional page/limit (limit ≤ 200)', async () => {
    await expect(validate(AuditLogsQueryDto, { page: '2', limit: '100' })).resolves.toMatchObject({ page: 2, limit: 100 });
    await bad(AuditLogsQueryDto, { limit: '201' });
    await bad(AuditLogsQueryDto, { page: '0' });
  });
});
