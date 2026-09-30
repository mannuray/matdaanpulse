import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AdminPersonsQueryDto, AuditLogsQueryDto, CandidatesQueryDto, ConstituencySearchQueryDto,
  ElectionsQueryDto, PartiesQueryDto,
} from './query.dto';

// Same options as main.ts / app.setup.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (metatype: any, value: Record<string, string>) =>
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
    await expect(validate(CandidatesQueryDto, { election_id: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    // Seed election ids are not RFC-versioned UUIDs; they must still pass.
    await expect(validate(CandidatesQueryDto, { election_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', const_id: 'BR_VS_1_x' }))
      .resolves.toBeDefined();
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
