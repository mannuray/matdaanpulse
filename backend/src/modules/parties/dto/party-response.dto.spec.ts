import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { PartyDetailDto } from './party-response.dto';

describe('PartyDetailDto', () => {
  it('keeps units with their roles and the lineage events', () => {
    const dto = plainToInstance(PartyDetailDto, {
      id: 'BJP', name: 'BJP', secret: 'x',
      units: [{ state_id: 5, state_name: 'Bihar', eci_recognition: 'National', office: null, website: null, roles: [{ role: 'state_president', person_id: 'p1', person_name: 'New', from_date: '2023-03-01', to_date: null, junk: 1 }] }],
      lineage: [{ party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false, note: null }],
    }, { excludeExtraneousValues: true });
    expect((dto as any).secret).toBeUndefined();
    expect(dto.units[0].roles[0]).toEqual({ role: 'state_president', person_id: 'p1', person_name: 'New', from_date: '2023-03-01', to_date: null });
    expect(dto.lineage[0].kind).toBe('split');
  });
  it('keeps a role holder photo and a lineage source', () => {
    const dto = plainToInstance(PartyDetailDto, {
      id: 'BJP', name: 'BJP',
      units: [{ state_id: 9, state_name: 'Jharkhand', roles: [{ role: 'state_president', person_id: 'p1', person_name: 'A', from_date: null, to_date: null, photo_url: '/m/a.jpg' }] }],
      lineage: [{ party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: 9, is_successor: true, note: null, source_url: 'https://x' }],
    }, { excludeExtraneousValues: true });
    expect(dto.units[0].roles[0].photo_url).toBe('/m/a.jpg');
    expect(dto.lineage[0].source_url).toBe('https://x');
  });
});
