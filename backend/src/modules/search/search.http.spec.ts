import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../app.setup';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Prisma } from '@prisma/client';

// Shaped like a Prisma `candidates` row with `include: { parties: true }`, affidavit set (BigInt columns).
const HIT = {
  id: 'c1', person_id: 'p1', election_id: 'e1', const_id: 'BR_VS_1', party_id: 'JDU', name: 'RAM KUMAR',
  is_incumbent: false, updated_at: new Date('2026-10-01T00:00:00Z'),
  age: 52, assets: BigInt('12345678901'), liabilities: BigInt(0), criminal_cases: 1,
  parties: { id: 'JDU', name: 'Janata Dal (United)', color: '#00f', abbreviation: 'JDU', eci_recognition: 'State' },
};

// Shaped like a Prisma `constituencies` row with `include: { districts: true }` (Decimal turnout, internal columns).
const SEAT = {
  id: 'BR_VS_182', election_id: 'e1', district_id: 7, state_id: 4, name: 'Patna Sahib', const_no: 182, type: 'GEN',
  voter_turnout: new Prisma.Decimal('56.34'), phase: 3, total_electors: 281234, metadata: { internal: true }, region_id: 2,
  current_round: null, total_rounds: null, updated_at: new Date('2026-10-01T00:00:00Z'),
  districts: { id: 7, state_id: 4, name: 'Patna', code: 'PAT', metadata: {}, updated_at: new Date('2026-10-01T00:00:00Z') },
};

describe('GET /search/constituencies (HTTP)', () => {
  let app: NestExpressApplication;
  let base: string;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: { searchCandidates: jest.fn(async () => []), searchConstituencies: jest.fn(async () => [SEAT, { ...SEAT, id: 'BR_VS_183', district_id: null, districts: null, voter_turnout: null }]) } }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureApp(app, {});
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  });
  afterAll(() => app.close());

  it('a seat hit is the public summary with `district: { id, name }` and a numeric turnout; no internal columns', async () => {
    const res = await fetch(`${base}/search/constituencies?q=patna`);
    expect(res.status).toBe(200);
    const [hit, noDistrict] = (await res.json()).data;
    expect(noDistrict).toMatchObject({ id: 'BR_VS_183', district_id: null, district: null, voter_turnout: null });
    expect(hit).toEqual({
      id: 'BR_VS_182', election_id: 'e1', district_id: 7, state_id: 4, name: 'Patna Sahib', const_no: 182, type: 'GEN',
      voter_turnout: 56.34, phase: 3, total_electors: 281234, current_round: null, total_rounds: null,
      district: { id: 7, name: 'Patna' },
    });
  });
});

describe('GET /search/candidates (HTTP)', () => {
  let app: NestExpressApplication;
  let base: string;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: { searchCandidates: jest.fn(async () => [HIT]), searchConstituencies: jest.fn(async () => [SEAT]) } }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureApp(app, {});
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  });
  afterAll(() => app.close());

  it('a hit with affidavit amounts is a 200 with the public candidate summary: no affidavit, no BigInt', async () => {
    const res = await fetch(`${base}/search/candidates?q=ram`);
    expect(res.status).toBe(200);
    const [hit] = (await res.json()).data;
    expect(hit).toEqual({
      id: 'c1', person_id: 'p1', election_id: 'e1', const_id: 'BR_VS_1', party_id: 'JDU', name: 'RAM KUMAR', is_incumbent: false,
      party: { id: 'JDU', name: 'Janata Dal (United)', color: '#00f', abbreviation: 'JDU' },
    });
  });
});
