import { plainToInstance } from 'class-transformer';
import { AdminPartiesController } from './admin-parties.controller';
import { AdminPersonsController } from './admin-persons.controller';
import { AdminCandidatesController } from './admin-candidates.controller';
import { AdminConstituenciesController } from './admin-constituencies.controller';
import { AdminPartyDto, AdminPersonDto, AdminCandidateDto, AdminConstituencyDto } from '../dto/admin-response.dto';
import { AuditLogService } from '../../audit-log/audit-log.service';

const map = (dto: any, data: unknown) => plainToInstance(dto, data, { excludeExtraneousValues: true }) as any;
const updated_at = new Date('2026-10-01T09:30:00Z');

function auditWith(row: unknown) {
  const prisma = { audit_logs: { findFirst: jest.fn().mockResolvedValue(row) } };
  return { audit: new AuditLogService(prisma as any), prisma };
}

describe('admin detail responses: updated_at + last_edit', () => {
  it('party: last_edit is null when the record was never edited; updated_at is ISO; eci_recognition exposed', async () => {
    const { audit, prisma } = auditWith(null);
    const svc = { findOne: jest.fn().mockResolvedValue({ id: 'BJP', name: 'BJP', eci_recognition: 'National', updated_at }) };
    const out = map(AdminPartyDto, await new AdminPartiesController(svc as any, audit).findOne('BJP'));
    expect(out).toMatchObject({ id: 'BJP', eci_recognition: 'National', updated_at: '2026-10-01T09:30:00.000Z', last_edit: null });
    expect(prisma.audit_logs.findFirst.mock.calls[0][0].where).toEqual({ entity_type: 'party', entity_id: 'BJP' });
  });

  it('party update: the user id goes to the service and the response carries the new last_edit', async () => {
    const { audit } = auditWith({ timestamp: new Date('2026-10-01T10:00:00Z'), users: { name: 'Mannu K' } });
    const svc = { update: jest.fn().mockResolvedValue({ id: 'BJP', name: 'BJP', updated_at }) };
    const out = map(AdminPartyDto, await new AdminPartiesController(svc as any, audit).updateParty({ user: { id: 'u1' } }, 'BJP', { name: 'BJP' }));
    expect(svc.update).toHaveBeenCalledWith('BJP', { name: 'BJP' }, 'u1');
    expect(out.last_edit).toEqual({ at: '2026-10-01T10:00:00.000Z', by: 'Mannu K' });
  });

  it('person, candidate and constituency details carry last_edit for their entity type', async () => {
    const edited = { timestamp: new Date('2026-10-01T10:00:00Z'), users: { name: 'Priya S' } };
    const { audit, prisma } = auditWith(edited);

    const persons = { findWithCandidates: jest.fn().mockResolvedValue({ id: 'p1', name: 'N', metadata: {}, updated_at, candidates: [] }) };
    const person = map(AdminPersonDto, await new AdminPersonsController(persons as any, audit).findPersonDetail('p1'));
    expect(person).toMatchObject({ updated_at: '2026-10-01T09:30:00.000Z', last_edit: { by: 'Priya S' } });

    const candidates = { findOne: jest.fn().mockResolvedValue({ id: 'c1', name: 'R', updated_at }) };
    const candidate = map(AdminCandidateDto, await new AdminCandidatesController(candidates as any, audit).findOne('c1'));
    expect(candidate).toMatchObject({ updated_at: '2026-10-01T09:30:00.000Z', last_edit: { by: 'Priya S' } });

    const seats = { findOneWithAnalysis: jest.fn().mockResolvedValue({ id: 'BR_VS_1', name: 'V', phase: 2, updated_at }) };
    const seat = map(AdminConstituencyDto, await new AdminConstituenciesController(seats as any, audit).getConstituencyDetail('BR_VS_1'));
    expect(seat).toMatchObject({ phase: 2, updated_at: '2026-10-01T09:30:00.000Z', last_edit: { by: 'Priya S' } });

    expect(prisma.audit_logs.findFirst.mock.calls.map((c: any) => c[0].where.entity_type)).toEqual(['person', 'candidate', 'constituency']);
  });
});
