// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { PersonPageView } from '../person/PersonPageView';
import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';

afterEach(cleanup);
const base: PersonPageVM = {
  status: 'ready', name: 'Ram Kripal Yadav', photo: null, photoCredit: null, currentParty: { label: 'BJP', name: 'Bharatiya Janata Party', mark: null, color: '#f80' },
  facts: { age: 67, gender: { labelKey: 'pp_gender_M', raw: 'M' }, education: 'Post Graduate', home: 'Patna, Bihar' }, wikipedia: 'https://en.wikipedia.org/wiki/R', bio: 'A long bio.',
  incumbent: true, stats: { contests: 2, wins: 1, decided: 2, winRate: 50, houses: ['LS'], parties: ['BJP', 'RJD'], switches: [{ from: 'JDU', to: 'BJP', fromLabel: 'JD(U)', toLabel: 'BJP', year: 2014 }] },
  contests: [{ key: 'a', year: 2014, electionName: 'Lok Sabha 2014', constituency: 'Patliputra', constHref: '/election/e/constituency/P', partyId: 'BJP', partyHref: '/election/e?party=BJP', partyLabel: 'BJP', partyName: 'Bharatiya Janata Party', house: 'LS', mark: null, color: '#f80', status: 'WON', votes: 383266, share: 39.1, margin: 40322, firstUnderParty: true }],
  affidavit: [{ year: 2014, house: 'LS', assets: 22000000, liabilities: null, criminalCases: 0 }], latest: { year: 2014, house: 'LS', assets: 22000000, liabilities: null, criminalCases: 0 },
};

describe('PersonPageView', () => {
  it('shows the photo credit as a link to its source', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, photo: 'https://blob/x.jpg', photoCredit: { source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A', licence: 'CC BY-SA 4.0' } }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Photo: A, CC BY-SA 4.0' }).getAttribute('href')).toBe('https://commons.wikimedia.org/wiki/File:X.jpg');
  });
  it('shows no credit line without a credit', () => {
    render(<MemoryRouter><PersonPageView vm={base} /></MemoryRouter>);
    expect(screen.queryByText(/^Photo:/)).toBeNull();
  });

  it('renders profile, stats with the switch, timeline and affidavit', () => {
    render(<MemoryRouter><PersonPageView vm={base} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Ram Kripal Yadav' })).toBeTruthy();
    expect(screen.getByText('Age 67')).toBeTruthy();
    expect(screen.getByText('Male')).toBeTruthy();
    expect(screen.getByText('Post Graduate')).toBeTruthy();
    expect(screen.getByText('Patna, Bihar')).toBeTruthy();
    expect(screen.getByText('A long bio.')).toBeTruthy();
    expect(screen.getByText('JD(U) → BJP in 2014')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Lok Sabha 2014/ }).getAttribute('href')).toBe('/election/e/constituency/P');
    expect(screen.getByText('(First contest under BJP)')).toBeTruthy();
    expect(screen.getAllByText('₹2.2 Cr').length).toBeGreaterThan(0);
  });

  it('the contest party links to the election dashboard party dialog, outside the card link', () => {
    const { container } = render(<MemoryRouter><PersonPageView vm={{ ...base, contests: [...base.contests, { ...base.contests[0], key: 'b', partyId: null, partyHref: null, partyLabel: '' }] }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Bharatiya Janata Party' }).getAttribute('href')).toBe('/election/e?party=BJP');
    expect(container.querySelectorAll('a a')).toHaveLength(0);
    // A party-less contest has no party link.
    expect(screen.getAllByRole('link', { name: /Lok Sabha 2014/ })).toHaveLength(2);
    expect(screen.getAllByRole('link').filter(a => a.getAttribute('href')?.includes('?party='))).toHaveLength(1);
  });

  it('a lost contest shows the shared Lost pill; the timeline list has no markers', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, contests: [{ ...base.contests[0], status: 'LOST' }] }} /></MemoryRouter>);
    expect(screen.getByText('Lost')).toBeTruthy();
    const ol = document.querySelector('ol')!;
    expect(ol.className.split(' ')).toEqual(expect.arrayContaining(['list-none', 'pl-0']));
  });

  it('a person with no contests, DOB or affidavit still shows the header', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, currentParty: null, facts: { age: null, gender: null, education: null, home: null }, wikipedia: null, bio: null,
      incumbent: false, stats: { contests: 0, wins: 0, decided: 0, winRate: null, houses: [], parties: [], switches: [] }, contests: [], affidavit: [], latest: null }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Ram Kripal Yadav' })).toBeTruthy();
    expect(screen.queryByText('Win rate')).toBeNull();
    expect(screen.queryByText('Affidavit')).toBeNull();
    expect(screen.queryByText(/Age/)).toBeNull();
  });

  it('shows the not-found state, and an unknown gender value as stored', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, status: 'notFound' }} /></MemoryRouter>);
    expect(screen.getByText('Person not found')).toBeTruthy();
    cleanup();
    render(<MemoryRouter><PersonPageView vm={{ ...base, facts: { ...base.facts, gender: { labelKey: null, raw: 'Non-binary' } } }} /></MemoryRouter>);
    expect(screen.getByText(/Non-binary/)).toBeTruthy();
  });
});

describe('PersonPageView header party', () => {
  it('the current party chip links to the party page', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, currentParty: { label: 'BJP', name: 'Bharatiya Janata Party', mark: null, color: '#f80', href: '/party/BJP' } }} /></MemoryRouter>);
    const chip = screen.getAllByRole('link').find(a => a.getAttribute('href') === '/party/BJP' && a.textContent?.includes('Bharatiya Janata Party · BJP'));
    expect(chip).toBeTruthy();
  });
});
