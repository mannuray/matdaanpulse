// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { ConstituencyPageView } from '../constituency/ConstituencyPageView';
import type { ConstituencyPageVM } from '../../viewmodels/pages/useConstituencyPageVM';

afterEach(cleanup);

const cand = (o: Record<string, unknown> & { name: string }) => ({ key: String(o.name), partyId: 'BJP', partyLabel: 'BJP', mark: null, color: '#f80', votes: 0, share: 0, pill: null, incumbent: false, photo: null, personId: null, nota: false, affidavit: null, ...o });
const vm = (over: Partial<ConstituencyPageVM> = {}): ConstituencyPageVM => ({
  status: 'ready', electionName: 'Bihar Vidhan Sabha 2025', electionHref: '/election/e1', stateName: 'Bihar', districtName: 'Patna',
  name: 'Patliputra', constNo: 30, type: 'SC', live: { kind: 'declared' },
  facts: { electors: 2000, votesPolled: 1000, turnout: 59.4, phase: 7, region: 'Magadh', district: 'Patna', progress: null },
  view: { totalVotes: 1000, margin: 220, others: null, candidates: [
    cand({ name: 'A', votes: 600, share: 60, pill: 'WON', personId: 'p1', affidavit: { age: 64, assets: 48000000, liabilities: 3200000, criminalCases: 5 } }),
    cand({ name: 'B', partyId: 'RJD', partyLabel: 'RJD', votes: 380, share: 38 }),
    cand({ name: 'NOTA', partyId: null, partyLabel: '', nota: true, votes: 20, share: 2 }),
  ] },
  history: [{ year: 2020, party: 'BJP', candidate: 'A', margin: 5, vote_share: 50.5, runner_up: 'B', runner_up_party: 'RJD' }], dominance: 'swing', notes: [],
  partyMeta: new Map(), locator: null, tracked: false, onToggleTrack: vi.fn(), shareText: 'x', personHref: id => `/person/${id}`, partyHref: id => `/election/e1?party=${id}`, election: null, ...over,
});
const renderIt = (v: ConstituencyPageVM) => render(<MemoryRouter><ConstituencyPageView vm={v} /></MemoryRouter>);

describe('ConstituencyPageView', () => {
  it('renders header, head-to-head, facts, the full table with affidavit columns and history', () => {
    renderIt(vm());
    expect(screen.getByRole('heading', { level: 1, name: 'Patliputra' })).toBeTruthy();
    expect(screen.getByText('No. 30 · SC')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3
    expect(within(table).getByText('₹4.8 Cr')).toBeTruthy();
    expect(within(table).getByText('5')).toBeTruthy();
    expect(screen.getByText(/Runner-up: B/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'A' }).getAttribute('href')).toBe('/person/p1');
  });

  it('party names link to the election dashboard party dialog (not NOTA)', () => {
    renderIt(vm());
    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: /RJD/ }).getAttribute('href')).toBe('/election/e1?party=RJD');
    const h2h = screen.getByRole('region', { name: 'Head-to-head' });
    expect(within(h2h).getByRole('link', { name: /BJP/ }).getAttribute('href')).toBe('/election/e1?party=BJP');
    expect(within(table).getAllByRole('link').filter(a => a.getAttribute('href')?.includes('?party='))).toHaveLength(2);
  });

  it('shows the not-found state', () => {
    renderIt(vm({ status: 'notFound' }));
    expect(screen.getByText('Constituency not found')).toBeTruthy();
  });

  it('hides empty tiles (no history, no notes, no locator)', () => {
    renderIt(vm({ history: [], notes: [], locator: null }));
    expect(screen.queryByText('Seat history')).toBeNull();
    expect(screen.queryByText('Insights')).toBeNull();
    expect(screen.queryByText('Locator')).toBeNull();
  });
});
