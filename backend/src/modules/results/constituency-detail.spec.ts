import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { ResultsService } from './results.service';
import { ConstituencyDetailDto } from './dto/constituency-detail.dto';

const row = {
  id: 'BR_VS_100_X', election_id: 'e1', name: 'X', const_no: 100, type: 'SC', voter_turnout: new Prisma.Decimal('59.40'), phase: 7,
  total_electors: 200000, current_round: 12, total_rounds: 24, metadata: { secret: 1 }, district_id: 1, state_id: 4, region_id: 2,
  districts: { id: 1, name: 'Patna', code: 'PAT', state_id: 4 }, states: { id: 4, name: 'Bihar', code: 'BR' }, regions: { id: 2, name: 'Magadh' },
  candidates: [
    { id: 'c2', name: 'Low', is_incumbent: false, person_id: 'p2', age: null, assets: null, liabilities: null, criminal_cases: null,
      parties: null, persons: { id: 'p2', photo_url: null, wikipedia_url: null },
      results: [{ votes: 10, status: 'TRAILING', margin: 0, last_updated: new Date('2026-02-27T05:00:00Z') }] },
    { id: 'c1', name: 'High', is_incumbent: true, person_id: 'p1', age: 64, assets: BigInt(48000000), liabilities: BigInt(3200000), criminal_cases: 1,
      parties: { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f80', symbol_url: '/symbols/logos/BJP.svg', eci_symbol_url: null },
      persons: { id: 'p1', photo_url: 'https://x/p1.png', wikipedia_url: 'https://en.wikipedia.org/wiki/H' },
      results: [{ votes: 900, status: 'LEADING', margin: 890, last_updated: new Date('2026-02-27T06:00:00Z') }] },
  ],
};

function svc() {
  const prisma: any = { constituencies: { findFirst: jest.fn().mockResolvedValue(row) } };
  return { s: new ResultsService(prisma, {} as any, {} as any), prisma };
}

describe('getConstituencyDetail', () => {
  it('selects only the public party and person fields', async () => {
    const { s, prisma } = svc();
    await s.getConstituencyDetail('e1', 'BR_VS_100_X');
    const inc = prisma.constituencies.findFirst.mock.calls[0][0].include;
    expect(inc.candidates.include.parties.select).toEqual({ id: true, name: true, abbreviation: true, color: true, symbol_url: true, eci_symbol_url: true });
    expect(inc.candidates.include.persons.select).toEqual({ id: true, photo_url: true, wikipedia_url: true });
  });

  it('sorts by votes, carries the affidavit and the latest update, and the DTO makes it JSON-safe', async () => {
    const { s } = svc();
    const out = plainToInstance(ConstituencyDetailDto, await s.getConstituencyDetail('e1', 'BR_VS_100_X'), { excludeExtraneousValues: true });
    const json = JSON.parse(JSON.stringify(out));
    expect(json.candidates.map((c: any) => c.name)).toEqual(['High', 'Low']);
    expect(json.candidates[0]).toMatchObject({ age: 64, assets: 48000000, liabilities: 3200000, criminal_cases: 1, votes: 900, status: 'LEADING',
      party: { id: 'BJP', symbol_url: '/symbols/logos/BJP.svg' }, person: { id: 'p1', wikipedia_url: 'https://en.wikipedia.org/wiki/H' } });
    expect(json.voter_turnout).toBe(59.4);
    expect(json.region).toEqual({ id: 2, name: 'Magadh' });
    expect(json.district).toEqual({ id: 1, name: 'Patna' });
    expect(json.last_updated).toBe('2026-02-27T06:00:00.000Z');
    expect(json.metadata).toBeUndefined();
  });

  it('a seat with no results has last_updated null', async () => {
    const { s, prisma } = svc();
    prisma.constituencies.findFirst.mockResolvedValue({ ...row, candidates: row.candidates.map(c => ({ ...c, results: [] })) });
    const out = await s.getConstituencyDetail('e1', 'BR_VS_100_X');
    expect(out.last_updated).toBeNull();
  });
});
