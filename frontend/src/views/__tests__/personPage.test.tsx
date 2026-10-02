// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { PersonPageView } from '../person/PersonPageView';
import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';

afterEach(cleanup);
const base: PersonPageVM = {
  status: 'ready', name: 'Ram Kripal Yadav', photo: null, currentParty: { label: 'BJP', mark: null, color: '#f80' },
  facts: { age: 67, gender: 'M', education: 'Post Graduate', home: 'Patna, Bihar' }, wikipedia: 'https://en.wikipedia.org/wiki/R', bio: 'A long bio.',
  incumbent: true, stats: { contests: 2, wins: 1, winRate: 50, parties: ['BJP', 'RJD'], switches: [{ from: 'RJD', to: 'BJP', year: 2014 }] },
  contests: [{ key: 'a', year: 2014, electionName: 'Lok Sabha 2014', constituency: 'Patliputra', constHref: '/election/e/constituency/P', partyId: 'BJP', partyLabel: 'BJP', mark: null, color: '#f80', status: 'WON', votes: 383266, share: 39.1, margin: 40322, firstUnderParty: true }],
  affidavit: [{ year: 2014, assets: 22000000, liabilities: null, criminalCases: 0 }], latest: { year: 2014, assets: 22000000, liabilities: null, criminalCases: 0 },
};

describe('PersonPageView', () => {
  it('renders profile, stats with the switch, timeline and affidavit', () => {
    render(<MemoryRouter><PersonPageView vm={base} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Ram Kripal Yadav' })).toBeTruthy();
    expect(screen.getByText(/Age 67 · Male · Post Graduate · Patna, Bihar/)).toBeTruthy();
    expect(screen.getByText('A long bio.')).toBeTruthy();
    expect(screen.getByText('RJD → BJP in 2014')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Lok Sabha 2014/ }).getAttribute('href')).toBe('/election/e/constituency/P');
    expect(screen.getByText('First contest under BJP')).toBeTruthy();
    expect(screen.getAllByText('₹2.2 Cr').length).toBeGreaterThan(0);
  });

  it('a person with no contests, DOB or affidavit still shows the header', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, currentParty: null, facts: { age: null, gender: null, education: null, home: null }, wikipedia: null, bio: null,
      incumbent: false, stats: { contests: 0, wins: 0, winRate: null, parties: [], switches: [] }, contests: [], affidavit: [], latest: null }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Ram Kripal Yadav' })).toBeTruthy();
    expect(screen.queryByText('Win rate')).toBeNull();
    expect(screen.queryByText('Affidavit')).toBeNull();
    expect(screen.queryByText(/Age/)).toBeNull();
  });

  it('shows the not-found state, and an unknown gender value as stored', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, status: 'notFound' }} /></MemoryRouter>);
    expect(screen.getByText('Person not found')).toBeTruthy();
    cleanup();
    render(<MemoryRouter><PersonPageView vm={{ ...base, facts: { ...base.facts, gender: 'Non-binary' } }} /></MemoryRouter>);
    expect(screen.getByText(/Non-binary/)).toBeTruthy();
  });
});
