// scraper/src/bihar/__tests__/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalize } from '../normalize';
import { YEARS } from '../years';
import { electionOf } from '../elections';
import type { PartyMap, RawElection } from '../types';

const map: PartyMap = {
  BHARATIYAJANATAPARTY: { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#FF6B00', recognition: 'National' },
};
const raw = (): RawElection => ({
  year: 2010,
  parties: [{ abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' }],
  seats: [1, 2].map(n => ({ constNo: n, acName: 'X', type: null, electors: 2000, nota: null, totalVotes: 900, candidates: [
    { serial: 1, name: 'RAM PRASAD', sex: 'M' as const, age: 40, party: 'IND', general: 300, postal: 0, total: 300 },
    { serial: 2, name: 'SITA DEVI', sex: 'F' as const, age: 35, party: 'BJP', general: 600, postal: 0, total: 600 },
  ] })),
  summaries: [1, 2].map(n => ({ constNo: n, name: 'X', type: 'GEN' as const, electors: 2000, voters: 901, contested: 2, totalValid: 900, nota: null,
    pollDate: n === 1 ? '2010-10-28' : '2010-10-21', winner: { party: 'BJP', name: 'S', votes: 600 }, runnerUp: { party: 'IND', name: 'R', votes: 300 }, margin: 300 })),
  performance: [],
});

describe('normalize', () => {
  it('names the seats only for a new election (existing JSON keeps its shape)', () => {
    const r = raw(); r.seats[0].acName = 'DISPUR';
    expect(normalize(r, electionOf('AS', 2026), map, '2026-10-03').json.seats[0].name).toBe('Dispur');
    expect('name' in normalize(raw(), YEARS[2010], map, '2026-10-03').json.seats[0]).toBe(false);
  });
  it('builds seats with statuses, display names, turnout and phase from poll date order', () => {
    const { json, errors } = normalize(raw(), YEARS[2010], map, '2026-10-03');
    expect(errors).toEqual([]);
    expect(json.parties.map(p => p.id).sort()).toEqual(['BJP', 'IND']);
    const [s1, s2] = json.seats;
    expect(s1).toMatchObject({ constNo: 1, type: 'GEN', electors: 2000, voters: 901, turnout: 45.05, phase: 2, pollDate: '2010-10-28' });
    expect(s2.phase).toBe(1);
    expect(s1.candidates).toEqual([
      { serial: 1, name: 'Ram Prasad', partyId: 'IND', sex: 'M', age: 40, votes: 300, status: 'LOST' },
      { serial: 2, name: 'Sita Devi', partyId: 'BJP', sex: 'F', age: 35, votes: 600, status: 'WON' },
    ]);
  });
  it('adds a NOTA candidate with a serial after every candidate serial (ECI serials skip NOTA\'s slot)', () => {
    const r = raw(); r.seats[0].nota = 25; r.seats[0].candidates[1].serial = 3;
    const { json } = normalize(r, YEARS[2010], map, '2026-10-03');
    expect(json.seats[0].candidates.at(-1)).toEqual({ serial: 4, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 25, status: 'LOST' });
  });
  it('collects unknown parties instead of throwing', () => {
    const { errors } = normalize(raw(), YEARS[2010], {}, '2026-10-03');
    expect(errors).toEqual(['party: no party-map entry for "Bharatiya Janata Party" (BJP)']);
  });
  it('a seat-type table sets every type; a file label that contradicts it is an error, a missing one is not', () => {
    const r = raw(); r.summaries[0].type = null as never; r.summaries[1].type = 'SC';
    const cfg = { ...electionOf('SK', 2019), seatTypes: { 2: 'ST' as const } };
    const { errors } = normalize(r, cfg, map, '2026-10-06');
    expect(errors).toEqual(['seat 2: the file says SC, the seat-type table says ST']);
    r.summaries[1].type = 'ST';
    const ok = normalize(r, cfg, map, '2026-10-06');
    expect(ok.errors).toEqual([]);
    expect(ok.json.seats.map(x => x.type)).toEqual(['GEN', 'ST']);
  });
  it('a seat won unopposed: voters and turnout null, flagged; no poll date → the election\'s poll date', () => {
    const r = raw();
    r.seats[1] = { ...r.seats[1], nota: null, totalVotes: 0, candidates: [{ ...r.seats[1].candidates[1], general: 0, postal: 0, total: 0 }] };
    r.summaries[1] = { ...r.summaries[1], voters: 0, contested: 1, totalValid: 0, pollDate: '', winner: { party: 'BJP', name: 'S', votes: 0 }, runnerUp: null, margin: 0, uncontested: true };
    const { json, errors } = normalize(r, YEARS[2010], map, '2026-10-06');
    expect(errors).toEqual([]);
    expect(json.seats[1]).toMatchObject({ voters: null, turnout: null, uncontested: true, pollDate: '2010-10-28', phase: 1 });
    expect(json.seats[1].candidates).toEqual([{ serial: 2, name: 'Sita Devi', partyId: 'BJP', sex: 'F', age: 35, votes: 0, status: 'WON' }]);
  });
  it('a seat won unopposed keeps no NOTA row even when the report prints NOTA 0 (Arunachal 2014)', () => {
    const r = raw();
    r.seats[1] = { ...r.seats[1], nota: 0, totalVotes: 0, candidates: [{ ...r.seats[1].candidates[1], general: 0, postal: 0, total: 0 }] };
    r.summaries[1] = { ...r.summaries[1], voters: 0, contested: 1, totalValid: 0, nota: 0, winner: { party: 'BJP', name: 'S', votes: 0 }, runnerUp: null, margin: 0, uncontested: true };
    expect(normalize(r, YEARS[2010], map, '2026-10-06').json.seats[1].candidates.map(c => c.partyId)).toEqual(['BJP']);
  });
  it('drops a "Shri"/"Smt" prefix when the state asks (Arunachal 2009/2019 write it on some names only)', () => {
    const r = raw(); r.seats[0].candidates[0].name = 'Shri Techi Kaso'; r.seats[0].candidates[1].name = 'SMT. SITA DEVI';
    const names = (cfg: object) => normalize(r, { ...electionOf('AR', 2019), ...cfg }, map, '2026-10-06').json.seats[0].candidates.map(c => c.name);
    expect(names({ stripHonorifics: true })).toEqual(['Techi Kaso', 'Sita Devi']);
    expect(names({ stripHonorifics: false })).toEqual(['Shri Techi Kaso', 'Smt. Sita Devi']);
  });
});
