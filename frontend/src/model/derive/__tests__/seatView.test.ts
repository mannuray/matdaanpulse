import { describe, it, expect } from 'vitest';
import { buildSeatView, seatHistory, seatNotes, detailToRows } from '../seatView';
import type { ResultRow, CandidateResult, AnalysisEntry } from '../../types';
import type { PartyMeta } from '../partyMeta';

const meta = new Map<string, PartyMeta>([['BJP', { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f80', mark: '/l.svg', eciRecognition: 'National' }]]);
const color = new Map([['BJP', '#f80'], ['RJD', '#0a0']]);
const r = (party_id: string, candidate_name: string, votes: number, status: string, margin = 0): ResultRow => ({ const_id: 'S', party_id, candidate_name, votes, status, margin });

describe('buildSeatView', () => {
  const rows = [r('RJD', 'B', 300, 'TRAILING'), r('NOTA', 'NOTA', 50, 'TRAILING'), r('BJP', 'A', 500, 'LEADING', 200), r('IND', 'C', 150, 'TRAILING'), r('IND', 'D', 100, 'TRAILING')];

  it('ranks by votes, NOTA last, share of all votes, pill only for leader/winner', () => {
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color });
    expect(v.candidates.map(c => c.name)).toEqual(['A', 'B', 'C', 'D', 'NOTA']);
    expect(v.candidates[0]).toMatchObject({ share: 45.5, pill: 'LEADING', partyLabel: 'BJP', mark: '/l.svg' });
    expect(v.candidates[1].pill).toBeNull();
    expect(v.candidates[4]).toMatchObject({ nota: true, partyId: null, personId: null });
    expect(v.totalVotes).toBe(1100);
    expect(v.margin).toBe(200);
  });

  it('caps rows and sums the rest as others (NOTA counts as other when capped)', () => {
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color, limit: 2 });
    expect(v.candidates.map(c => c.name)).toEqual(['A', 'B']);
    expect(v.others).toEqual({ count: 3, votes: 300, share: 27.3 });
  });

  it('a seat with zero votes has 0% shares, no pills and no margin', () => {
    const v = buildSeatView([r('BJP', 'A', 0, 'TRAILING'), r('RJD', 'B', 0, 'TRAILING')], { partyMeta: meta, partyColor: color });
    expect(v.candidates.map(c => c.share)).toEqual([0, 0]);
    expect(v.candidates.every(c => c.pill === null)).toBe(true);
    expect(v.margin).toBeNull();
  });

  it('joins photo, person, incumbent and affidavit from the detail by party + name', () => {
    const detail: CandidateResult[] = [{ id: 'c1', name: 'a', party: null, is_incumbent: true, votes: 0, status: null, margin: 0, person_id: 'p1',
      person: { id: 'p1', photo_url: '/p1.png' }, age: 60, assets: 100, liabilities: 0, criminal_cases: 2 }];
    (detail[0] as CandidateResult).party = { id: 'BJP', name: 'x', color: null, symbol_url: null, eci_symbol_url: null };
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color, detail });
    expect(v.candidates[0]).toMatchObject({ photo: '/p1.png', personId: 'p1', incumbent: true, affidavit: { age: 60, assets: 100, liabilities: 0, criminalCases: 2 } });
    expect(v.candidates[1]).toMatchObject({ photo: null, personId: null, affidavit: null });
  });

  it('an independent without a party row uses its id as the label and the fallback colour', () => {
    const v = buildSeatView([r('IND', 'C', 10, 'LEADING')], { partyMeta: meta, partyColor: color });
    expect(v.candidates[0]).toMatchObject({ partyId: 'IND', partyLabel: 'IND', mark: null, color: 'var(--color-fallback)' });
  });
});

describe('seatHistory', () => {
  it('drops the current year and sorts newest first', () => {
    const a = { incumbency: { seat_history: [{ year: 2015, party: 'JDU', candidate: 'X', margin: 1 }, { year: 2025, party: 'BJP', candidate: 'A', margin: 2 }, { year: 2020, party: 'BJP', candidate: 'A', margin: 3, vote_share: 50.5 }] } } as unknown as AnalysisEntry;
    expect(seatHistory(a, 2025).map(h => h.year)).toEqual([2020, 2015]);
    expect(seatHistory(null, 2025)).toEqual([]);
  });
});

describe('seatNotes', () => {
  it('flags a 3-way contest when the third candidate out-polls the margin', () => {
    const v = buildSeatView([r('BJP', 'A', 500, 'LEADING', 200), r('RJD', 'B', 300, 'TRAILING'), r('IND', 'C', 250, 'TRAILING')], { partyMeta: meta, partyColor: color });
    expect(seatNotes(v, null)).toEqual([{ kind: 'threeWay', thirdVotes: 250, margin: 200 }]);
  });
  it('adds the spoiler from the analysis', () => {
    const v = buildSeatView([r('BJP', 'A', 500, 'WON', 200), r('RJD', 'B', 300, 'LOST')], { partyMeta: meta, partyColor: color });
    const a = { incumbency: { spoiler: { spoiler_party: 'VIP', spoiler_votes: 900, winner_margin: 200 } } } as unknown as AnalysisEntry;
    expect(seatNotes(v, a)).toEqual([{ kind: 'spoiler', party: 'VIP', votes: 900, margin: 200 }]);
  });
  it('no notes for an uncounted seat', () => {
    expect(seatNotes(buildSeatView([], { partyMeta: meta, partyColor: color }), null)).toEqual([]);
  });
});

describe('detailToRows', () => {
  it('turns detail candidates into result rows', () => {
    const rows = detailToRows('S', [{ id: 'c', name: 'A', party: { id: 'BJP', name: '', color: null, symbol_url: null, eci_symbol_url: null }, is_incumbent: false, votes: 5, status: 'WON', margin: 3 }]);
    expect(rows).toEqual([{ const_id: 'S', party_id: 'BJP', candidate_name: 'A', votes: 5, status: 'WON', margin: 3 }]);
  });

  it('a detail candidate without a party uses empty string (joins detail by key)', () => {
    const detail: CandidateResult[] = [{ id: 'c1', name: 'C', party: null, is_incumbent: true, votes: 0, status: null, margin: 0, person_id: 'p1',
      person: { id: 'p1', photo_url: '/c.png' }, age: 25, assets: 50, liabilities: 10, criminal_cases: 0 }];
    const rows = detailToRows('S', detail);
    expect(rows).toEqual([{ const_id: 'S', party_id: '', candidate_name: 'C', votes: 0, status: 'PENDING', margin: 0 }]);
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color, detail });
    expect(v.candidates[0]).toMatchObject({ photo: '/c.png', personId: 'p1', incumbent: true, affidavit: { age: 25, assets: 50, liabilities: 10, criminalCases: 0 } });
  });
});
