import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { AdminPartiesController } from './admin-parties.controller';
import { AdminPersonsController } from './admin-persons.controller';
import { AdminCandidatesController } from './admin-candidates.controller';
import { AdminConstituenciesController } from './admin-constituencies.controller';
import {
  AdminPartyDto, AdminPersonDto, AdminCandidateDto, AdminConstituencyDto, AdminPartyUsageDto, AdminCandidateResultDto, AdminSeatHistoryDto,
} from '../dto/admin-response.dto';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PersonsService } from '../../candidates/persons.service';
import { CandidatesService } from '../../candidates/candidates.service';
import { CandidateSummaryDto } from '../../candidates/dto/candidate-response.dto';

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

describe('AdminConstituencyDto: the record page fields', () => {
  it('keeps the state code and the analysis notes and computed time (ISO)', () => {
    const out = map(AdminConstituencyDto, {
      id: 'BR_VS_176', voter_turnout: new Prisma.Decimal('58.40'), state: { id: 5, code: 'BR', name: 'Bihar' },
      analysis: { id: 'a1', dominance: 'STRONG', dominance_party: 'JDU', incumbency: { incumbent_name: 'H' }, notes: 'Held since 2010', updated_at },
    });
    expect(out.voter_turnout).toBe(58.4);
    expect(out.state).toEqual({ id: 5, code: 'BR', name: 'Bihar' });
    expect(out.analysis).toMatchObject({ dominance: 'STRONG', notes: 'Held since 2010', updated_at: '2026-10-01T09:30:00.000Z' });
  });
});

describe('admin derived read endpoints: response mapping keeps every field', () => {
  const { audit } = auditWith(null);

  it('party usage keeps totals and election rows', async () => {
    const usage = { totals: { candidates: 3, elections: 1, wins: 1 }, elections: [{ election_id: 'e1', name: 'E', type: 'VS', year: 2025, candidates: 3, wins: 1 }] };
    const svc = { usage: jest.fn().mockResolvedValue(usage) };
    expect(map(AdminPartyUsageDto, await new AdminPartiesController(svc as any, audit).usage('BJP'))).toEqual(usage);
  });

  it('candidate result keeps the strip and the seat rows, nulls included', async () => {
    const row = { candidate_id: 'c1', name: 'R', party_id: null, votes: 0, share: null, position: null, status: null, margin: null };
    const out = { declared: false, total_votes: 0, candidate: row, seat: [row] };
    const svc = { seatResult: jest.fn().mockResolvedValue(out) };
    expect(map(AdminCandidateResultDto, await new AdminCandidatesController(svc as any, audit).result('c1'))).toEqual(out);
  });

  it('seat history keeps volatility and rows', async () => {
    const out = {
      volatility: { elections: 2, changes: 1 },
      rows: [{ election_id: 'e1', year: 2025, type: 'VS', winner: 'A', party_id: 'BJP', margin: 10, turnout: 61.2, is_current: true }],
    };
    const svc = { history: jest.fn().mockResolvedValue(out) };
    expect(map(AdminSeatHistoryDto, await new AdminConstituenciesController(svc as any, audit).history('BR_VS_1'))).toEqual(out);
  });
});

describe('PersonsService.findWithCandidates (election history)', () => {
  const contest = (id: string, year: number, status: string, result: { status: string; votes: number; margin: number } | null) => ({
    id: `c-${id}`, name: 'Nitish Kumar', party_id: 'JDU', election_id: `e-${id}`, const_id: `s-${id}`, is_incumbent: year === 2025,
    parties: { name: 'Janata Dal (United)', color: '#16a34a' },
    elections: { name: `Bihar Vidhan Sabha ${year}`, year, type: 'VS', status },
    constituencies: { name: 'Harnaut', const_no: 179 },
    results: result ? [result] : [],
  });

  it('returns the history newest first with election type/status and seat number, and they survive AdminPersonDto', async () => {
    const prisma = {
      persons: {
        findUnique: jest.fn(async () => ({
          id: 'p1', name: 'Nitish Kumar', metadata: {}, updated_at, states: null, districts: null,
          // Stored order is by election id, not year.
          candidates: [
            contest('a', 2015, 'Finalized', { status: 'WON', votes: 10, margin: 3 }),
            contest('b', 2025, 'Live', null),
            contest('c', 2020, 'Finalized', { status: 'LOST', votes: 5, margin: 0 }),
          ],
        })),
      },
    };
    const svc = new PersonsService(prisma as any, new AuditLogService(prisma as any));
    const out = map(AdminPersonDto, await svc.findWithCandidates('p1'));
    expect(out.candidates.map((c: any) => c.election_year)).toEqual([2025, 2020, 2015]);
    expect(out.candidates[2]).toEqual({
      id: 'c-a', name: 'Nitish Kumar', party_id: 'JDU', party_name: 'Janata Dal (United)', party_color: '#16a34a',
      election_id: 'e-a', election_name: 'Bihar Vidhan Sabha 2015', election_year: 2015, election_type: 'VS', election_status: 'Finalized',
      const_id: 's-a', constituency_name: 'Harnaut', const_no: 179, votes: 10, status: 'WON', margin: 3, is_incumbent: false,
    });
    expect(out.candidates[0]).toMatchObject({ election_status: 'Live', status: null, is_incumbent: true });
  });
});

describe('admin candidate detail: relations reach the admin under the names it reads', () => {
  // A `CandidatesService.findOne` row: Prisma relation names, and a Decimal turnout on the seat.
  const row = {
    id: 'c1', person_id: 'p1', election_id: 'e1', const_id: 'ADILABAD', party_id: 'BJP', name: 'GODAM NAGESH', is_incumbent: true,
    metadata: { age: 58 }, updated_at,
    parties: { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A' },
    constituencies: { id: 'ADILABAD', election_id: 'e1', name: 'Adilabad', const_no: 1, type: 'ST', voter_turnout: new Prisma.Decimal('65.28') },
    persons: { id: 'p1', name: 'Godam Nagesh', photo_url: null, metadata: {} },
    elections: { id: 'e1', status: 'Finalized' },
  };

  it('exposes party, constituency and person (not the Prisma relation names), and a Decimal turnout as a number', async () => {
    const { audit } = auditWith(null);
    const svc = { findOne: jest.fn().mockResolvedValue(row) };
    const out = map(AdminCandidateDto, await new AdminCandidatesController(svc as any, audit).findOne('c1'));
    expect(out).toMatchObject({
      is_incumbent: true,
      party: { id: 'BJP', color: '#FF7A1A' },
      constituency: { const_no: 1, name: 'Adilabad', voter_turnout: 65.28 },
      person: { id: 'p1', name: 'Godam Nagesh' },
    });
    expect(out).not.toHaveProperty('parties');
    expect(out).not.toHaveProperty('constituencies');
    expect(out).not.toHaveProperty('persons');
  });

  it('a seat with a Decimal turnout maps on its own too (constituency detail)', () => {
    expect(map(AdminConstituencyDto, row.constituencies).voter_turnout).toBe(65.28);
    expect(map(AdminConstituencyDto, { ...row.constituencies, voter_turnout: null }).voter_turnout).toBeNull();
  });
});

describe('admin candidates list and same-name search: the person link and affidavit reach the admin', () => {
  it('findAll selects person_id and metadata, and the admin list keeps them with the party', async () => {
    const listRow = { id: 'c2', name: 'Anil Kumar', party_id: 'BJP', const_id: 's1', is_incumbent: false, person_id: 'p1', metadata: { age: 44, criminal_cases: 2 }, parties: { id: 'BJP', color: '#f59e0b' } };
    const prisma = { candidates: { findMany: jest.fn().mockResolvedValue([listRow]) } };
    const svc = new CandidatesService(prisma as any, {} as any, {} as any);
    const rows = await new AdminCandidatesController(svc, {} as any).findAll('e1', 's1');
    expect(prisma.candidates.findMany.mock.calls[0][0].select).toMatchObject({ person_id: true, metadata: true });
    await svc.findAll({ election_id: 'e1' }); // the public path
    const publicSelect = prisma.candidates.findMany.mock.calls[1][0].select;
    expect(publicSelect.person_id).toBe(true);
    expect(publicSelect).not.toHaveProperty('metadata');
    expect(map(AdminCandidateDto, rows)[0]).toMatchObject({ person_id: 'p1', metadata: { age: 44, criminal_cases: 2 }, party: { id: 'BJP' } });
  });

  it('the public summary (used by the same-name suggestions) says whether a candidate already has a person record', () => {
    expect(map(CandidateSummaryDto, { id: 'c1', name: 'R', person_id: 'p1', metadata: { x: 1 } })).toEqual({ id: 'c1', name: 'R', person_id: 'p1' });
  });
});
