import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseCandidateDetailPage } from '../../live/adapters/eci-parse';
import { topCandidates, matchPhoto, emitPhotosSeed, ECI_CREDIT } from '../photos';
import type { SeatJson } from '../types';

const seat: SeatJson = { constNo: 1, type: 'GEN', electors: 1, voters: 1, turnout: 1, phase: 1, pollDate: '2025-11-11', candidates: [
  { serial: 1, name: 'Surendra Prasad', partyId: 'INC', sex: 'M', age: 59, votes: 107730, status: 'WON' },
  { serial: 2, name: 'Dhirendra Pratap Singh Alias Rinku Singh', partyId: 'JDU', sex: 'M', age: 45, votes: 106055, status: 'LOST' },
  { serial: 3, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 6400, status: 'LOST' },
  { serial: 4, name: 'Rameshwar Yadav', partyId: 'BSP', sex: 'M', age: 50, votes: 9000, status: 'LOST' },
  { serial: 5, name: 'Small One', partyId: 'IND', sex: 'M', age: 30, votes: 900, status: 'LOST' },
  { serial: 6, name: 'Smaller One', partyId: 'IND', sex: 'M', age: 30, votes: 800, status: 'LOST' },
] };
const eci = [
  { name: 'SURENDRA PRASAD', party: 'Indian National Congress', votes: 107730, margin: 1675, status: 'won' as const, photo: 'https://results.eci.gov.in/a.jpg' },
  { name: 'DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH', party: 'Janata Dal (United)', votes: 106055, margin: -1675, status: 'lost' as const, photo: 'https://results.eci.gov.in/b.jpg' },
  { name: 'RAMESHWAR YADAV', party: 'Bahujan Samaj Party', votes: 9001, margin: 0, status: 'lost' as const, photo: 'https://results.eci.gov.in/c.jpg' },
  { name: 'NOBODY', party: 'Independent', votes: 900, margin: 0, status: 'lost' as const, photo: null },
];

describe('photos', () => {
  it('takes the top n candidates by votes, without NOTA', () => {
    expect(topCandidates(seat, 4).map(c => c.serial)).toEqual([1, 2, 4, 5]);
  });
  it('matches by exact votes with a name check, else by a close unique name', () => {
    expect(matchPhoto(seat.candidates[0], eci)).toBe('https://results.eci.gov.in/a.jpg');
    expect(matchPhoto(seat.candidates[3], eci)).toBe('https://results.eci.gov.in/c.jpg'); // votes differ by one, name matches
    expect(matchPhoto(seat.candidates[4], eci)).toBeNull(); // same votes, different name, no photo
  });
  it('emits ECI credits every run and a run-once fill-only photo update', () => {
    const sql = emitPhotosSeed([{ candidateId: '11111111-1111-1111-1111-111111111111', url: 'https://blob/persons/eci2025/1-1.jpg', sourceUrl: 'https://web.archive.org/web/2025/x' }]);
    const always = sql.slice(0, sql.indexOf('\\if :seed_apply'));
    expect(always).toContain(`('https://blob/persons/eci2025/1-1.jpg', 'https://web.archive.org/web/2025/x', '${ECI_CREDIT.author}', '${ECI_CREDIT.licence}')`);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_candidate_photos')");
    expect(sql).toContain('SET photo_url = COALESCE(p.photo_url, v.url)');
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', 'https://blob/persons/eci2025/1-1.jpg')");
  });
});

describe('emitPhotosSeed for another state', () => {
  it('names the seed and the election', () => {
    const sql = emitPhotosSeed([{ candidateId: 'c1', url: 'https://blob/x.jpg', sourceUrl: 'https://eci/x.jpg' }], { seedName: 'seed_as_candidate_photos', label: 'Assam 2026' });
    expect(sql).toContain("seed_runs WHERE name = 'seed_as_candidate_photos'");
    expect(sql).toContain('Assam 2026 top-4');
    expect(sql).not.toMatch(/Bihar/);
  });
});

describe('2026 candidate-wise pages (results.eci.gov.in/ResultAcGenMay2026)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../live/__tests__/fixtures/eci-2026-candidateswise-S0333.htm'), 'utf8');
  const eci = parseCandidateDetailPage(html);
  const cand = (name: string, votes: number) => ({ serial: 1, name, partyId: 'IND', sex: null, age: null, votes, status: 'LOST' as const });
  it('reads every card with votes and photo', () => {
    expect(eci.find(e => e.name === 'PRADYUT BORDOLOI')).toMatchObject({ votes: 103337, status: 'won' });
    expect(eci.find(e => e.name === 'PRADYUT BORDOLOI')!.photo).toMatch(/PRADY-2026-20260323102154\.jpg$/);
  });
  it('matches by the card\'s votes and name, never by the photo file name', () => {
    expect(matchPhoto(cand('Jayanta Kumar Das', 22802), eci)).toMatch(/SRIJA-2026-20260323091916\.jpg$/);
  });
  it('gives no photo when no card has the votes and the name is not clearly on the page', () => {
    expect(matchPhoto(cand('Someone Else', 12345), eci)).toBeNull();
  });
});
