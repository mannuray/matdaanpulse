// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { PartyPageView } from '../party/page/PartyPageView';
import type { PartyPageVM } from '../../viewmodels/pages/usePartyPageVM';

afterEach(cleanup);

const party = { id: 'BJP', name: 'Bharatiya Janata Party', color: '#f80', abbreviation: 'BJP', symbol_url: null, eci_symbol_url: null, eci_recognition: 'National' as const,
  leader_name: 'J. P. Nadda', founded_year: 1980, headquarters: 'New Delhi', website: 'https://bjp.org', wikipedia_url: null, description: 'About the party.' };
const vm = (over: Partial<PartyPageVM> = {}): PartyPageVM => ({
  status: 'ready', party, mark: null, color: '#f80', view: 'national', stateCode: null, missingState: null,
  chips: [{ code: '', name: '', href: '/party/BJP', active: true }, { code: 'JH', name: 'Jharkhand', href: '/party/BJP?state=JH', active: false }],
  headline: { won: 41, seats: 121, statesWon: 2, statesContested: 2, governs: null, largest: 1 },
  states: [
    { code: 'JH', name: 'Jharkhand', year: 2024, won: 21, contested: 68, seatsTotal: 81, share: 33.2, delta: { seats: -4, share: -0.2, vsLabel: null }, spark: [30, 25, 21], president: { name: 'Babulal Marandi', personId: 'p1', photo: null }, href: '/party/BJP?state=JH' },
    { code: 'GA', name: 'Goa', year: 2022, won: 20, contested: 40, seatsTotal: 40, share: 33.3, delta: { seats: null, share: 1.2, vsLabel: null }, spark: [20], president: null, href: '/party/BJP?state=GA' },
  ],
  lineage: [{ party_id: 'BJP', predecessor_id: 'BJS', kind: 'rename', effective_date: '1980-04-06', state_id: null, is_successor: true, note: 'Re-formed', source_url: 'https://src' }],
  noResults: false, stateView: null, recordError: false, retry: vi.fn(), nameOf: id => id, ...over,
});
const renderIt = (v: PartyPageVM) => render(<MemoryRouter><PartyPageView vm={v} /></MemoryRouter>);

describe('PartyPageView, national', () => {
  it('header: name, abbreviation, recognition and only the profile fields it has', () => {
    renderIt(vm({ party: { ...party, headquarters: null } }));
    expect(screen.getByRole('heading', { level: 1, name: /Bharatiya Janata Party/ })).toBeTruthy();
    expect(screen.getByText('National party')).toBeTruthy();
    expect(screen.getByText(/Founded/).textContent).toContain('1980');
    expect(screen.queryByText(/New Delhi/)).toBeNull();
  });
  it('headline: holds N of M seats at each state’s latest election; governs not recorded', () => {
    renderIt(vm());
    expect(screen.getByText('41')).toBeTruthy();
    expect(screen.getByText(/at each state's latest election/)).toBeTruthy();
    expect(screen.getByText(/not recorded/)).toBeTruthy();
  });
  it('states table: rows link to the state view; a redraw shows "—" for seats; no "view all"', () => {
    renderIt(vm());
    const links = screen.getAllByRole('link', { name: /Jharkhand/ }).map(a => a.getAttribute('href'));
    expect(links).toContain('/party/BJP?state=JH');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText(/view all/i)).toBeNull();
    expect(screen.getAllByText('Babulal Marandi').length).toBeGreaterThan(0);
  });
  it('lineage with its source link; about text', () => {
    renderIt(vm());
    expect(screen.getByRole('link', { name: /source/i }).getAttribute('href')).toBe('https://src');
    expect(screen.getByText('About the party.')).toBeTruthy();
  });
  it('no assembly results: the line, no chips or table', () => {
    renderIt(vm({ noResults: true, chips: [], states: [] }));
    expect(screen.getByText(/No assembly results on MatdaanPulse yet/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('not found and a failed record', () => {
    renderIt(vm({ status: 'notFound', party: null }));
    expect(screen.getByText(/Party not found/)).toBeTruthy();
    cleanup();
    renderIt(vm({ recordError: true, states: [], chips: [] }));
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
  it('missing state note', () => {
    renderIt(vm({ missingState: 'KL' }));
    expect(screen.getByText(/has no results in KL yet/)).toBeTruthy();
  });
});
