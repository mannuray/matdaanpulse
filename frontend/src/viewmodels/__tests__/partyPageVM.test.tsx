// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const api = { getParty: vi.fn(), getParties: vi.fn(), getPartyRecord: vi.fn() };
vi.mock('../../model/api/geo.service', () => ({ getParty: (...a: unknown[]) => api.getParty(...a), getParties: (...a: unknown[]) => api.getParties(...a), getPartyLineage: vi.fn().mockResolvedValue([]) }));
vi.mock('../../model/api/party.service', () => ({ getPartyRecord: (...a: unknown[]) => api.getPartyRecord(...a) }));

import { usePartyPageVM } from '../pages/usePartyPageVM';
import { ApiError } from '../../model/api/api-client';
import type { PartyRecordElection } from '../../model/types';

const el = (id: string, state_id: number, code: string, name: string, year: number, won: number): PartyRecordElection => ({
  election_id: id, state_id, state_code: code, state_name: name, year, date: `${year}-12-01`, delimitation: '2008', contested: 60, won, votes: 1, share: 30,
  held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0, seats_total: 81, largest: false, formed_government: null, family: [] });
const party = (units: unknown[] = []) => ({ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f80', abbreviation: 'BJP', symbol_url: null, eci_symbol_url: null,
  eci_recognition: 'National', leader_name: null, founded_year: 1980, headquarters: null, website: null, wikipedia_url: null, description: null, units, lineage: [] });
const president = { state_id: 9, state_name: 'Jharkhand', eci_recognition: 'State', office: null, website: null,
  roles: [{ role: 'state_president', person_id: 'p1', person_name: 'Babulal Marandi', from_date: '2023-07-01', to_date: null, photo_url: '/b.jpg' }] };

function hook(id: string, path: string) {
  let loc = '';
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  const r = renderHook(() => { const l = useLocation(); loc = l.pathname + l.search; return usePartyPageVM(id); }, { wrapper });
  return { ...r, loc: () => loc };
}

beforeEach(() => {
  api.getParties.mockResolvedValue([]);
  api.getParty.mockImplementation((id: string) => Promise.resolve({ ...party([president]), id }));
  api.getPartyRecord.mockResolvedValue({ party_id: 'BJP', lineage: [], elections: [el('a', 9, 'JH', 'Jharkhand', 2024, 21), el('g', 3, 'GA', 'Goa', 2022, 20), el('b', 9, 'JH', 'Jharkhand', 2019, 25)] });
});

describe('usePartyPageVM', () => {
  it('national view: "All states" chip first, states by seats won with links and the current president', async () => {
    const { result } = hook('BJP', '/party/BJP');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.states).toHaveLength(2));
    expect(result.current.view).toBe('national');
    expect(result.current.chips[0]).toMatchObject({ code: '', active: true, href: '/party/BJP' });
    expect(result.current.states.map(s => s.code)).toEqual(['JH', 'GA']);
    expect(result.current.states[0]).toMatchObject({ href: '/party/BJP?state=JH', won: 21, president: { name: 'Babulal Marandi', personId: 'p1', photo: '/b.jpg' } });
    expect(result.current.states[0].delta).toEqual({ seats: -4, share: 0, vsLabel: null });
    expect(result.current.headline.won).toBe(41);
  });
  it('?state in lower case opens the state view', async () => {
    api.getPartyRecord.mockImplementation((_id: string, state?: string) => Promise.resolve({ party_id: 'BJP', lineage: [],
      elections: [el('a', 9, 'JH', 'Jharkhand', 2024, 21), el('g', 3, 'GA', 'Goa', 2022, 20)],
      ...(state ? { state: { code: state, election_id: 'a', mlas: [], flow: [], regions: null } } : {}) }));
    const { result } = hook('BJP', '/party/BJP?state=jh');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.view).toBe('state'));
    expect(result.current.stateCode).toBe('JH');
    expect(api.getPartyRecord).toHaveBeenCalledWith('BJP', 'JH');
  });
  it('?state the party never contested: national view with a note', async () => {
    const { result } = hook('BJP', '/party/BJP?state=KL');
    await waitFor(() => expect(result.current.states).toHaveLength(2));
    expect(result.current.view).toBe('national');
    expect(result.current.missingState).toBe('KL');
  });
  it('a one-state party opens on its state view', async () => {
    api.getPartyRecord.mockResolvedValue({ party_id: 'JMM', lineage: [], elections: [el('a', 9, 'JH', 'Jharkhand', 2024, 34)] });
    const { loc } = hook('JMM', '/party/JMM');
    await waitFor(() => expect(loc()).toBe('/party/JMM?state=JH'));
  });
  it('404 → notFound; a failed record → ready with recordError', async () => {
    api.getParty.mockRejectedValueOnce(new ApiError('nf', 404));
    const a = hook('NOPE', '/party/NOPE');
    await waitFor(() => expect(a.result.current.status).toBe('notFound'));
    api.getPartyRecord.mockImplementation((id: string) => (id === 'BJP2' ? Promise.reject(new Error('boom')) : Promise.resolve({ party_id: id, lineage: [], elections: [] })));
    const b = hook('BJP2', '/party/BJP2');
    await waitFor(() => expect(b.result.current.recordError).toBe(true));
    expect(b.result.current.status).toBe('ready');
  });
  it('no assembly results: noResults, no chips, no states', async () => {
    api.getPartyRecord.mockResolvedValue({ party_id: 'NEW', lineage: [], elections: [] });
    const { result } = hook('NEW', '/party/NEW');
    await waitFor(() => expect(result.current.noResults).toBe(true));
    expect(result.current.chips).toEqual([]);
    expect(result.current.states).toEqual([]);
  });
});

describe('usePartyPageVM, state view', () => {
  const stateRec = (over: Record<string, unknown> = {}) => ({
    party_id: 'BJP', lineage: [],
    elections: [{ ...el('a', 9, 'JH', 'Jharkhand', 2024, 21), held: 14, gained: 7, lost: 9 }, el('b', 9, 'JH', 'Jharkhand', 2019, 25)],
    state: { code: 'JH', election_id: 'a',
      mlas: [{ person_id: 'p1', name: 'Babulal Marandi', photo_url: null, const_id: 'C1', const_name: 'Dhanwar', margin: 100 },
             { person_id: 'p2', name: 'C P Singh', photo_url: null, const_id: 'C2', const_name: 'Ranchi', margin: 50 }],
      flow: [{ from: 'JMM', to: 'BJP', seats: 4, split: false }, { from: 'BJP', to: 'INC', seats: 3, split: false }],
      regions: [{ region: 'Palamu', seats: 9, won: 5 }] },
    ...over,
  });
  it('unit roles, record lines, changes from the flow, MLAs, sections', async () => {
    api.getPartyRecord.mockResolvedValue(stateRec());
    const { result } = hook('BJP', '/party/BJP?state=JH');
    await waitFor(() => expect(result.current.stateView).not.toBeNull());
    const sv = result.current.stateView!;
    expect(sv).toMatchObject({ code: 'JH', name: 'Jharkhand', year: 2024, won: 21, seatsTotal: 81, president: { name: 'Babulal Marandi' }, leader: null });
    expect(sv.lines.map(l => l.kind)).toEqual(['election', 'election']);
    expect(sv.chart.map(c => c.year)).toEqual([2019, 2024]);
    expect(sv.changes).toEqual({ held: 14, gained: 7, lost: 9, gainedFrom: [{ party: 'JMM', seats: 4, split: false }], lostTo: [{ party: 'INC', seats: 3, split: false }] });
    expect(sv.sections).toEqual(['record', 'map', 'changes', 'mlas', 'regions']);
    expect(sv.mlas.map(m => m.name).sort()).toEqual(['Babulal Marandi', 'C P Singh']);
  });
  it('a state with no unit, no regions and no earlier comparable election shows only what it has', async () => {
    api.getParty.mockImplementation((id: string) => Promise.resolve({ ...party([]), id }));
    api.getPartyRecord.mockResolvedValue(stateRec({ elections: [el('a', 9, 'JH', 'Jharkhand', 2024, 21)], state: { code: 'JH', election_id: 'a', mlas: [], flow: [], regions: null } }));
    const { result } = hook('BJP', '/party/BJP?state=JH');
    await waitFor(() => expect(result.current.stateView).not.toBeNull());
    const sv = result.current.stateView!;
    expect(sv.president).toBeNull();
    expect(sv.pastPresidents).toEqual([]);
    expect(sv.changes).toBeNull();
    expect(sv.sections).toEqual(['record', 'map', 'changes']);   // the seat-changes card always shows ("first election on these boundaries")
  });
});

describe('usePartyPageVM, switching views', () => {
  it('moving to a state never shows the previous payload as that state; a failed state request is an error with retry', async () => {
    api.getPartyRecord.mockImplementation((_id: string, state?: string) => (state ? Promise.reject(new Error('boom'))
      : Promise.resolve({ party_id: 'BJP', lineage: [], elections: [el('a', 9, 'JH', 'Jharkhand', 2024, 21), el('g', 3, 'GA', 'Goa', 2022, 20)] })));
    let go: (to: string) => void = () => {};
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/party/BJP']}>{children}</MemoryRouter>;
    const { result } = renderHook(() => { go = useNavigate(); return usePartyPageVM('BJP'); }, { wrapper });
    await waitFor(() => expect(result.current.states).toHaveLength(2));
    act(() => go('/party/BJP?state=JH'));
    expect(result.current.stateView).toBeNull();
    await waitFor(() => expect(result.current.recordError).toBe(true));
    expect(result.current.stateView).toBeNull();
  });
});

describe('usePartyPageVM, skipped elections', () => {
  it('the seat-changes card follows the state\'s previous election, even one the party skipped', async () => {
    api.getPartyRecord.mockResolvedValue({ party_id: 'BJP', lineage: [],
      elections: [{ ...el('a', 9, 'JH', 'Jharkhand', 2024, 21), gained: 21 }, el('c', 9, 'JH', 'Jharkhand', 2014, 37)],
      state_elections: [{ election_id: 'a', state_id: 9, year: 2024, date: '2024-12-01', delimitation: '2008' }, { election_id: 'b', state_id: 9, year: 2019, date: '2019-12-01', delimitation: '2008' }, { election_id: 'c', state_id: 9, year: 2014, date: '2014-12-01', delimitation: '2008' }],
      state: { code: 'JH', election_id: 'a', mlas: [], flow: [], regions: null } });
    const { result } = hook('BJP', '/party/BJP?state=JH');
    await waitFor(() => expect(result.current.stateView).not.toBeNull());
    expect(result.current.stateView!.changes).toMatchObject({ gained: 21 });
    expect(result.current.stateView!.delta).toEqual({ seats: null, share: null, vsLabel: null, notContested: 2019 });
  });
});
