import { describe, it, expect } from 'vitest';
import { contestStatus, contestViews, personStats, affidavitSeries, ageFrom } from '../personPage';
import type { PersonCandidate } from '../../types';

const c = (o: Partial<PersonCandidate>): PersonCandidate => ({ id: 'x', name: 'N', party_id: 'BJP', party_name: 'BJP', party_color: '#f80', election_name: 'E', election_year: 2020, election_id: 'e', constituency_name: 'S', const_id: 'S', votes: 1, status: 'WON', margin: 1, is_incumbent: false, election_status: 'Finalized', ...o });

describe('contestStatus', () => {
  it('Lost only once the election is finalized', () => {
    expect(contestStatus(c({ status: 'TRAILING', election_status: 'Live' }))).toBe('TRAILING');
    expect(contestStatus(c({ status: 'LOST', election_status: 'Finalized' }))).toBe('LOST');
    expect(contestStatus(c({ status: null, election_status: 'Finalized' }))).toBe('LOST');
    expect(contestStatus(c({ status: null, election_status: 'Upcoming' }))).toBe('PENDING');
    expect(contestStatus(c({ status: 'LOST', election_status: 'Live' }))).toBe('PENDING');
    expect(contestStatus(c({ status: 'LEADING', election_status: 'Live' }))).toBe('LEADING');
  });
});

describe('personStats', () => {
  const cands = [c({ election_year: 2025, status: 'LEADING', election_status: 'Live', party_id: 'BJP' }), c({ election_year: 2014, party_id: 'BJP' }), c({ election_year: 2009, status: 'LOST', party_id: 'RJD' })];
  it('counts contests and decided wins; detects the party switch', () => {
    expect(personStats(cands)).toEqual({ contests: 3, wins: 1, decided: 2, winRate: 50, houses: [], parties: ['BJP', 'RJD'], switches: [{ from: 'RJD', to: 'BJP', fromLabel: 'RJD', toLabel: 'BJP', year: 2014 }] });
  });
  it('labels a switch with the contest party abbreviation, falling back to the id', () => {
    const s = personStats([c({ election_year: 2009, party_id: 'JDU', party_abbreviation: 'JD(U)' }), c({ election_year: 2014, party_id: 'BJP', party_abbreviation: null })]);
    expect(s.switches).toEqual([{ from: 'JDU', to: 'BJP', fromLabel: 'JD(U)', toLabel: 'BJP', year: 2014 }]);
  });
  it('no contests: zeros and no win rate', () => {
    expect(personStats([])).toEqual({ contests: 0, wins: 0, decided: 0, winRate: null, houses: [], parties: [], switches: [] });
  });
  it('lists the houses contested, Lok Sabha first', () => {
    expect(personStats([c({ election_type: 'VS' }), c({ election_type: 'LS' }), c({ election_type: 'VS' })]).houses).toEqual(['LS', 'VS']);
  });
});

describe('contestViews', () => {
  it('newest first, marks the first contest under a new party, links the seat', () => {
    const v = contestViews([c({ election_year: 2009, party_id: 'RJD', const_id: 'A', election_id: 'e09' }), c({ election_year: 2014, party_id: 'BJP', party_symbol_url: '/b.svg', vote_share: 39.1 })]);
    expect(v.map(x => x.year)).toEqual([2014, 2009]);
    expect(v[0]).toMatchObject({ firstUnderParty: true, mark: '/b.svg', share: 39.1 });
    expect(v[1]).toMatchObject({ firstUnderParty: false, constHref: '/election/e09/constituency/A', partyHref: '/election/e09?party=RJD' });
  });
  it('a party-less contest has no party link', () => {
    expect(contestViews([c({ party_id: null })])[0].partyHref).toBeNull();
  });
  it('returning to an earlier party is not a first contest', () => {
    const v = contestViews([c({ id: 'a', election_year: 2009, party_id: 'RJD' }), c({ id: 'b', election_year: 2014, party_id: 'BJP' }), c({ id: 'd', election_year: 2019, party_id: 'RJD' })]);
    expect(v.map(x => x.firstUnderParty)).toEqual([false, true, false]);
  });
});

describe('affidavitSeries', () => {
  it('oldest first, skipping contests without affidavit values', () => {
    expect(affidavitSeries([c({ election_year: 2025, assets: 48000000, liabilities: 3200000, criminal_cases: 1 }), c({ election_year: 2014 }), c({ election_year: 2009, assets: 11000000 })]))
      .toEqual([{ year: 2009, house: null, assets: 11000000, liabilities: null, criminalCases: null }, { year: 2025, house: null, assets: 48000000, liabilities: 3200000, criminalCases: 1 }]);
  });
});

describe('ageFrom', () => {
  it('computes whole years and handles a missing date', () => {
    expect(ageFrom('1958-10-03', new Date('2026-10-02'))).toBe(67);
    expect(ageFrom('1958-10-02', new Date('2026-10-02'))).toBe(68);
    expect(ageFrom(null)).toBeNull();
  });
});
