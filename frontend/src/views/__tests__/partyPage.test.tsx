// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { PartyPageView } from '../party/page/PartyPageView';
import type { PartyPageVM, PartyStateView } from '../../viewmodels/pages/usePartyPageVM';
import type { MlaSearchVM } from '../../viewmodels/pages/useMlaSearch';

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
  noResults: false, stateView: null, map: null, recordError: false, retry: vi.fn(), nameOf: id => id, ...over,
});
const noSearch: MlaSearchVM = { query: '', setQuery: vi.fn(), filtered: [] };
const renderIt = (v: PartyPageVM, search: MlaSearchVM = { ...noSearch, filtered: v.stateView?.mlas ?? [] }) =>
  render(<MemoryRouter><PartyPageView vm={v} mlaSearch={search} /></MemoryRouter>);

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
  it('a state whose previous election the party skipped: "not contested in 2017", no change', () => {
    const v = vm();
    renderIt(vm({ states: [{ ...v.states[1], delta: { seats: null, share: null, vsLabel: null, notContested: 2017 } }] }));
    expect(screen.getAllByText(/not contested in 2017/).length).toBeGreaterThan(0);
  });
  it('missing state note', () => {
    renderIt(vm({ missingState: 'KL' }));
    expect(screen.getByText(/has no results in KL yet/)).toBeTruthy();
  });
});

const row = (year: number, won: number, delimitation = '2008') => ({ election_id: `e${year}`, state_id: 9, state_code: 'JH', state_name: 'Jharkhand', year, date: `${year}-12-01`,
  delimitation, contested: 68, won, votes: 1, share: 33, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0, seats_total: 81, largest: false, formed_government: null, family: [] });
const sv = (over: Partial<PartyStateView> = {}): PartyStateView => ({
  code: 'JH', name: 'Jharkhand', electionId: 'e2024', year: 2024, won: 21, seatsTotal: 81, share: 33.2, delta: { seats: -4, share: -0.2, vsLabel: null },
  recognition: 'State', office: 'Ranchi', website: null,
  president: { name: 'Babulal Marandi', personId: 'p1', photo: null, since: '2023-07-01' }, leader: null, pastPresidents: [{ name: 'Deepak Prakash', from: '2020-02-01', to: '2023-07-01' }],
  lines: [
    { kind: 'election', row: row(2024, 21), delta: { seats: -7, share: -5, vsLabel: 'BJP + JVM(P) 2019' } },
    { kind: 'event', event: { party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: 9, is_successor: true, note: null } },
    { kind: 'election', row: row(2019, 25), delta: null },
    { kind: 'redraw', delimitation: '2008', year: 2019 },
    { kind: 'election', row: row(2005, 30, '1976'), delta: null },
  ],
  chart: [{ year: 2005, won: 30, share: 23 }, { year: 2019, won: 25, share: 33 }, { year: 2024, won: 21, share: 33 }],
  changes: { held: 14, gained: 7, lost: 9, gainedFrom: [{ party: 'JMM', seats: 4, split: false }], lostTo: [{ party: 'INC', seats: 3, split: true }] },
  mlas: [], regions: [{ region: 'Palamu', seats: 9, won: 5 }],
  sections: ['record', 'map', 'changes', 'mlas', 'regions'], ...over,
});
const mlas = Array.from({ length: 300 }, (_, i) => ({ personId: `p${i}`, name: `MLA ${i}`, photo: null, constId: `C${i}`, constName: `Seat ${i}`, margin: 1000 - i }));

describe('PartyPageView, state', () => {
  it('jump links for the sections it has; unit with past presidents; record events, vs label and redraw divider', () => {
    renderIt(vm({ view: 'state', stateCode: 'JH', stateView: sv({ sections: ['record', 'map', 'changes'] }) }));
    const jumps = screen.getAllByRole('link').map(a => a.getAttribute('href')).filter(h => h?.startsWith('#pty-'));
    expect(jumps).toEqual(['#pty-record', '#pty-map', '#pty-changes']);
    expect(screen.getAllByText('Babulal Marandi').length).toBeGreaterThan(0);
    expect(screen.getByText('Deepak Prakash')).toBeTruthy();
    expect(screen.getByText(/JVM merged into BJP/)).toBeTruthy();
    expect(screen.getByText(/vs BJP \+ JVM\(P\) 2019/)).toBeTruthy();
    expect(screen.getByText('New boundaries from 2019')).toBeTruthy();
    expect(screen.getByText('21 / 81 seats')).toBeTruthy();
  });
  it('seat changes with a split tag; regions; unit card hidden without holders', () => {
    renderIt(vm({ view: 'state', stateCode: 'JH', stateView: sv({ president: null, pastPresidents: [] }) }));
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('JMM')).toBeTruthy();
    expect(screen.getByText('split')).toBeTruthy();
    expect(screen.getByText('Palamu')).toBeTruthy();
    expect(document.getElementById('pty-unit')).toBeNull();
  });
  it('first election on these boundaries: the changes card says so', () => {
    renderIt(vm({ view: 'state', stateCode: 'JH', stateView: sv({ changes: null, sections: ['record', 'map'] }) }));
    expect(screen.getByText(/First election on these boundaries/)).toBeTruthy();
  });
  it('a 300-MLA state lists every MLA (no "show more"); typing searches', () => {
    const setQuery = vi.fn();
    renderIt(vm({ view: 'state', stateCode: 'JH', stateView: sv({ mlas }) }), { query: '', setQuery, filtered: mlas });
    expect(document.querySelectorAll('#pty-mlas li')).toHaveLength(300);
    expect(screen.queryByText(/show more|view all/i)).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'seat 1' } });
    expect(setQuery).toHaveBeenCalledWith('seat 1');
  });
});
