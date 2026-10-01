// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Candidate, CandidateResult, SeatRow } from '../types';

const data = vi.hoisted(() => {
  const seat = (id: string, const_no: number, name: string, election_id = 'e1') => ({ id, election_id, name, const_no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {} });
  return {
    seats: { e1: [seat('s142', 142, 'Patna Sahib'), seat('s1', 1, 'Valmiki Nagar')], e2: [seat('k5', 5, 'Kochi', 'e2')] } as Record<string, ReturnType<typeof seat>[]>,
    elections: [
      { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null },
      { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Finalized', state_id: 2, tentative_next_date: null, manifest_url: null },
    ],
  };
});
const svc = vi.hoisted(() => ({
  getCandidates: vi.fn(),
  getCandidate: vi.fn(),
  searchCandidates: vi.fn(async (_q: string): Promise<unknown[]> => []),
  updateCandidate: vi.fn(async (_id: string, _data: Record<string, unknown>) => ({})),
  linkCandidatePerson: vi.fn(async (_c: string, _p: string) => ({})),
  unlinkCandidatePerson: vi.fn(async () => ({})),
  createCandidate: vi.fn(),
  getCandidateResult: vi.fn(),
}));
vi.mock('../services/candidate.service', () => svc);
const people = vi.hoisted(() => ({
  getPersons: vi.fn(async (..._args: unknown[]) => ({ success: true, data: [] as unknown[], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
  createPerson: vi.fn(async () => ({ id: 'p9' })),
}));
vi.mock('../services/person.api', () => people);
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async (eid: string) => data.seats[eid] ?? []) }));
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => [{ id: 'BJP', name: 'Bharatiya Janata Party' }, { id: 'IND', name: 'Independent' }]) }));
// A tiny stateful stand-in for the global election, so "Switch election" really re-renders the page.
const ctx = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const s = {
    electionId: 'e1',
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    setElectionId: vi.fn((id: string) => { s.electionId = id; listeners.forEach((l) => l()); }),
  };
  return s;
});
vi.mock('../context/ElectionContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useElection: () => {
      const electionId = useSyncExternalStore(ctx.subscribe, () => ctx.electionId);
      return {
        elections: data.elections, electionId, election: data.elections.find((e) => e.id === electionId) ?? null,
        setElectionId: ctx.setElectionId, loading: false, error: null, reload: vi.fn(),
      };
    },
  };
});
import Candidates from './Candidates';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';
import { getConstituencies } from '../services/constituency.service';

const cand = (id: string, name: string, const_id: string, over: Partial<Candidate> = {}): Candidate => ({
  id, person_id: null, person: null, election_id: 'e1', const_id, party_id: 'BJP',
  party: { id: 'BJP', name: 'Bharatiya Janata Party', color: '#f59e0b', abbreviation: 'BJP' } as Candidate['party'],
  name, is_incumbent: false, metadata: { age: 50, criminal_cases: 0 }, ...over,
});
const ROWS: Record<string, Candidate[]> = {
  s1: [
    cand('c1', 'Ravi Prasad', 's1', { person_id: 'p1', person: { id: 'p1', name: 'Ravi Shankar Prasad', photo_url: null, gender: 'Male', education: null, date_of_birth: null } }),
    cand('c2', 'Anil Kumar', 's1', { metadata: { age: 44, criminal_cases: 2 } }),
    cand('nota', 'NOTA', 's1', { party_id: 'NOTA' }),
  ],
  s142: [cand('c9', 'Priya Kumari', 's142')],
};
const OTHER = { k1: cand('k1', 'Thomas Isaac', 'k5', { election_id: 'e2' }) };

const seatRow = (candidate_id: string, name: string, over: Partial<SeatRow> = {}): SeatRow => ({
  candidate_id, name, party_id: 'BJP', votes: 0, share: null, position: null, status: null, margin: null, ...over,
});
// Valmiki Nagar (s1) is counted: Ravi won by 12,309.
const S1_SEAT: SeatRow[] = [
  seatRow('c1', 'Ravi Prasad', { votes: 78412, share: 41.3, position: 1, status: 'WON', margin: 12309 }),
  seatRow('c2', 'Anil Kumar', { party_id: 'JDU', votes: 66103, share: 34.8, position: 2, status: 'LOST', margin: -12309 }),
  seatRow('nota', 'NOTA', { party_id: 'NOTA', votes: 1890, share: 1, status: 'LOST' }),
];
const RESULTS: Record<string, Omit<CandidateResult, 'candidate'>> = {
  s1: { declared: true, total_votes: 189810, seat: S1_SEAT },
  // Patna Sahib (s142) has no vote counts yet.
  s142: { declared: false, total_votes: 0, seat: [seatRow('c9', 'Priya Kumari', { status: 'TRAILING' })] },
};

beforeEach(() => {
  ctx.electionId = 'e1';
  svc.getCandidates.mockImplementation(async (_e: string, cid: string) => ROWS[cid] ?? []);
  svc.getCandidate.mockImplementation(async (id: string) => {
    const c = Object.values(ROWS).flat().find((x) => x.id === id) ?? OTHER[id as 'k1'];
    const constituency = Object.values(data.seats).flat().find((s) => s.id === c.const_id);
    return { ...c, constituency };
  });
  svc.getCandidateResult.mockImplementation(async (id: string) => {
    const c = Object.values(ROWS).flat().find((x) => x.id === id) ?? OTHER[id as 'k1'];
    const r = RESULTS[c?.const_id] ?? { declared: false, total_votes: 0, seat: [] };
    return { ...r, candidate: r.seat.find((x) => x.candidate_id === id) ?? null };
  });
});
afterEach(() => {
  cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks();
  ROWS.s1 = ROWS.s1.filter((c) => !c.id.startsWith('new-'));
  ROWS.s142 = ROWS.s142.filter((c) => !c.id.startsWith('new-'));
});

const renderAt = (at = '/candidates') => renderEntityPage('/candidates', <Candidates />, at);
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Candidates' });
const seatInput = () => screen.getByRole('combobox', { name: 'Seat' }) as HTMLInputElement;

const record = (name: string) => screen.findByRole('heading', { level: 1, name });
const card = (title: string | RegExp) => screen.getByRole('heading', { name: title }).closest('section')!;
const save = () => screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
const backTo = (label: string | RegExp) => screen.getByRole('button', { name: label });

describe('Candidates list', () => {
  it('uses the global election, defaults to the lowest seat, hides NOTA, and filters by link state', async () => {
    renderAt();
    expect(await within(table()).findByText('Ravi Prasad')).toBeTruthy();
    expect(within(table()).queryByText('NOTA')).toBeNull();
    expect(seatInput().value).toBe('1 Valmiki Nagar');
    expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1');
    fireEvent.click(screen.getByRole('button', { name: /^Unlinked/ }));
    expect(within(table()).queryByText('Ravi Prasad')).toBeNull();
    expect(within(table()).getByText('Anil Kumar')).toBeTruthy();
  });

  it('?seat= preselects that seat (the constituency record links here); an unknown seat falls back to the lowest', async () => {
    renderAt('/candidates?election=e1&seat=s142');
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's142'));
    expect(seatInput().value).toBe('142 Patna Sahib');
    expect(svc.getCandidates).not.toHaveBeenCalledWith('e1', 's1');
    cleanup();
    renderAt('/candidates?seat=k5');
    await waitFor(() => expect(seatInput().value).toBe('1 Valmiki Nagar'));
  });

  it('is full width: a row opens the record page in place of the list, and back returns to the same seat and filter', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Anil Kumar'));
    expect(where()).toBe('/candidates/c2');
    expect(await record('Anil Kumar')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Candidates' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(backTo('Candidates · 1 Valmiki Nagar'));
    expect(where()).toBe('/candidates');
    expect(await within(table()).findByText('Anil Kumar')).toBeTruthy();
    expect(seatInput().value).toBe('1 Valmiki Nagar');
  });

  it('a failed seats load says "Could not load seats" and Try again reloads them', async () => {
    vi.mocked(getConstituencies).mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt();
    expect(await screen.findByText('Could not load seats')).toBeTruthy();
    expect(screen.queryByText('No seats in this election')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Ravi Prasad')).toBeTruthy();
    expect(getConstituencies).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Could not load seats')).toBeNull();
  });

  it('a failed candidates load says "Could not load candidates" and Try again reloads them', async () => {
    svc.getCandidates.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt();
    expect(await screen.findByText('Could not load candidates')).toBeTruthy();
    expect(screen.queryByText('No candidates match')).toBeNull();
    const calls = svc.getCandidates.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Ravi Prasad')).toBeTruthy();
    expect(svc.getCandidates.mock.calls.length).toBe(calls + 1);
    expect(screen.queryByText('Could not load candidates')).toBeNull();
  });
});

describe('Candidate record page', () => {
  it('header: party chip, Incumbent tag, "<election> · <seat>" meta and the seat in the back label', async () => {
    const orig = ROWS.s1[0];
    ROWS.s1[0] = { ...orig, is_incumbent: true };
    try {
      renderAt('/candidates/c1');
      const h = await record('Ravi Prasad');
      const header = h.closest('header')!;
      expect(within(header).getByText('BJP')).toBeTruthy();
      expect(within(header).getByText('Incumbent')).toBeTruthy();
      expect(within(header).getByText('Bihar VS 2025 · 1 Valmiki Nagar')).toBeTruthy();
      expect(backTo('Candidates · 1 Valmiki Nagar')).toBeTruthy();
    } finally {
      ROWS.s1[0] = orig;
    }
  });

  it('the result strip shows votes, share with a bar, position with the status badge, margin and "Result declared"', async () => {
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    const result = card('Result');
    expect(await within(result).findByText('78,412')).toBeTruthy();
    expect(within(result).getByText('41.3%')).toBeTruthy();
    expect(within(result).getByText('1st')).toBeTruthy();
    expect(within(result).getByText('Won')).toBeTruthy();
    expect(within(result).getByText('+12,309')).toBeTruthy();
    expect(within(result).getByText('Result declared')).toBeTruthy();
    expect(svc.getCandidateResult).toHaveBeenCalledWith('c1');
  });

  it('a loser shows the gap to the winner as negative', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const result = card('Result');
    expect(await within(result).findByText('−12,309')).toBeTruthy();
    expect(within(result).getByText('2nd')).toBeTruthy();
    expect(within(result).getByText('Behind the winner')).toBeTruthy();
  });

  it('a seat with no vote counts says so, shows no NaN, and still lists the candidates', async () => {
    renderAt('/candidates/c9');
    await record('Priya Kumari');
    const result = card('Result');
    expect(await within(result).findByText('No vote counts recorded')).toBeTruthy();
    expect(within(result).queryByText('Result declared')).toBeNull();
    const seat = card('Other candidates in Patna Sahib');
    expect(within(seat).getByText('Priya Kumari')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('"Other candidates" lists the seat with this candidate highlighted and NOTA last; a row opens that candidate', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const seat = card('Other candidates in Valmiki Nagar');
    await within(seat).findByText(/Ravi Prasad/);
    expect(within(seat).getByText('1 Valmiki Nagar · 2 candidates')).toBeTruthy();
    const items = within(seat).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Ravi Prasad'), expect.stringContaining('Anil Kumar'), expect.stringContaining('NOTA'),
    ]);
    expect(within(items[1]).getByText(/Anil Kumar/).closest('[aria-current="true"]')).toBeTruthy();
    expect(within(items[1]).queryByRole('button')).toBeNull();
    fireEvent.click(within(items[0]).getByRole('button'));
    expect(where()).toBe('/candidates/c1');
    expect(await record('Ravi Prasad')).toBeTruthy();
  });

  it('opening another candidate of the seat asks first when the form has unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    const seat = card('Other candidates in Valmiki Nagar');
    fireEvent.click(within(await within(seat).findByText(/Ravi Prasad/).then((el) => el.closest('li')!)).getByRole('button'));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/candidates/c2');
    fireEvent.click(backTo('Candidates · 1 Valmiki Nagar'));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/candidates/c2');
  });

  it('a failed result load offers Try again', async () => {
    svc.getCandidateResult.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    const result = card('Result');
    fireEvent.click(await within(result).findByRole('button', { name: 'Try again' }));
    expect(await within(result).findByText('78,412')).toBeTruthy();
  });

  it('opening an unlinked candidate pre-fills the person search; Save sends no photo_url', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    await waitFor(() => expect((screen.getByLabelText('Find a person') as HTMLInputElement).value).toBe('Anil Kumar'));
    await waitFor(() => expect(people.getPersons).toHaveBeenCalledWith(1, 10, 'Anil Kumar'));
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.click(save());
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    const [id, payload] = svc.updateCandidate.mock.calls[0];
    expect(id).toBe('c2');
    expect(payload).not.toHaveProperty('photo_url');
    expect(payload.metadata).toEqual(expect.objectContaining({ age: 45, criminal_cases: 2 }));
  });

  it('the Incumbent toggle is editable and saved; emptied affidavit fields go out as null', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const toggle = screen.getByRole('switch', { name: 'Incumbent candidate' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '' } });
    fireEvent.click(save());
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    const [, payload] = svc.updateCandidate.mock.calls[0];
    expect(payload.is_incumbent).toBe(true);
    expect(payload.metadata).toEqual(expect.objectContaining({ age: null, gender: null, education: null, assets: null, criminal_cases: 2 }));
  });

  it('declared assets show the rupee value in Indian grouping with crore or lakh', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Declared assets'), { target: { value: '24500000' } });
    expect(screen.getByText('₹2,45,00,000 · ₹2.45 crore')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Declared assets'), { target: { value: '8500000' } });
    expect(screen.getByText('₹85,00,000 · ₹85 lakh')).toBeTruthy();
  });

  it('a deep link to a candidate in another seat shows that seat in the list behind it', async () => {
    renderAt('/candidates/c9');
    await record('Priya Kumari');
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's142'));
    fireEvent.click(backTo('Candidates · 142 Patna Sahib'));
    expect(await within(table()).findByText('Priya Kumari')).toBeTruthy();
    expect(seatInput().value).toBe('142 Patna Sahib');
  });

  it('a candidate from another election offers "Switch election", which asks first when dirty', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/k1');
    await record('Thomas Isaac');
    expect(screen.getByText(/This record is in Kerala VS 2021/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '61' } });
    fireEvent.click(screen.getByRole('button', { name: 'Switch election' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(ctx.setElectionId).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Switch election' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e2');
  });

  it('"Switch election" on a record of another election shows its seat in that election', async () => {
    renderAt('/candidates/k1');
    await record('Thomas Isaac');
    fireEvent.click(screen.getByRole('button', { name: 'Switch election' }));
    await waitFor(() => expect(screen.queryByText(/This record is in/)).toBeNull());
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e2', 'k5'));
    expect(svc.getCandidates).not.toHaveBeenCalledWith('e2', 's1');
    fireEvent.click(backTo(/^Candidates/));
    await waitFor(() => expect(seatInput().value).toBe('5 Kochi'));
  });

  it('after leaving a record, a later election switch no longer moves the Seat select to it', async () => {
    renderAt('/candidates/c9');
    await record('Priya Kumari');
    fireEvent.click(backTo('Candidates · 142 Patna Sahib'));
    await waitFor(() => expect(seatInput().value).toBe('142 Patna Sahib'));
    expect(where()).toBe('/candidates');
    act(() => ctx.setElectionId('e2'));
    await waitFor(() => expect(seatInput().value).toBe('5 Kochi'));
    act(() => ctx.setElectionId('e1'));
    await waitFor(() => expect(seatInput().value).toBe('1 Valmiki Nagar'));
  });

  it('a stored candidate without a party shows Independent (listed once, first) and stays clean; Save writes IND', async () => {
    const orig = ROWS.s1[1];
    ROWS.s1[1] = { ...orig, party_id: null, party: null };
    try {
      renderAt('/candidates/c2');
      await record('Anil Kumar');
      const party = screen.getByLabelText('Party') as HTMLSelectElement;
      await waitFor(() => expect(party.options.length).toBe(2));
      expect(Array.from(party.options).map((o) => o.textContent)).toEqual(['Independent', 'Bharatiya Janata Party']);
      expect(party.value).toBe('IND');
      expect(screen.getByText('No changes')).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
      fireEvent.click(save());
      await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalledWith('c2', expect.objectContaining({ party_id: 'IND' })));
    } finally {
      ROWS.s1[1] = orig;
    }
  });

  it('a non-numeric age shows an inline error and blocks Save', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: 'forty' } });
    expect(screen.getByText('Enter a whole number')).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '44' } });
    expect(screen.queryByText('Enter a whole number')).toBeNull();
  });

  it('a deep link to an unknown candidate says "Candidate not found", with no toast', async () => {
    svc.getCandidate.mockRejectedValueOnce(new ApiError('Candidate not found', 404));
    renderAt('/candidates/00000000-0000-0000-0000-000000000000');
    const alert = await screen.findByRole('alert');
    expect(await within(alert).findByText('Candidate not found')).toBeTruthy();
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByText('Failed to load candidate data')).toBeNull();
  });

  it('a non-404 load failure says "Could not load candidate" and Try again reloads', async () => {
    svc.getCandidate.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/candidates/c2');
    const alert = (await screen.findByText('Could not load candidate')).closest('[role="alert"]') as HTMLElement;
    expect(within(alert).queryByText('Candidate not found')).toBeNull();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(((await screen.findByLabelText('Name')) as HTMLInputElement).value).toBe('Anil Kumar');
  });
});

describe('Candidate record: master record', () => {
  it('a linked candidate shows the person, "Open person" asks before leaving unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    const master = card('Master record');
    expect(within(master).getByText('Ravi Shankar Prasad')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '51' } });
    fireEvent.click(within(master).getByRole('link', { name: /Open person/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/candidates/c1');
  });

  it('Unlink asks first; a cancelled unlink changes nothing; Unlink is disabled while the form is dirty', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    const unlink = within(card('Master record')).getByRole('button', { name: 'Unlink' }) as HTMLButtonElement;
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1'));
    const calls = svc.getCandidates.mock.calls.length;
    fireEvent.click(unlink);
    expect(confirm).toHaveBeenCalledWith('Unlink from master record?');
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.unlinkCandidatePerson).not.toHaveBeenCalled();
    expect(svc.getCandidates.mock.calls.length).toBe(calls);
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '51' } });
    expect(unlink.disabled).toBe(true);
  });

  it('a confirmed Unlink unlinks and refreshes the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1'));
    const calls = svc.getCandidates.mock.calls.length;
    fireEvent.click(within(card('Master record')).getByRole('button', { name: 'Unlink' }));
    await waitFor(() => expect(svc.unlinkCandidatePerson).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(svc.getCandidates.mock.calls.length).toBeGreaterThan(calls));
  });

  it('same-name suggestions show in the card (and as a list badge) and link the checked matches', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const master = card('Master record');
    fireEvent.click(await within(master).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    fireEvent.click(within(master).getByRole('button', { name: 'Link selected' }));
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledWith('old', 'p9'));
    expect(people.createPerson).toHaveBeenCalledWith('Anil Kumar');
    expect(svc.linkCandidatePerson).toHaveBeenCalledWith('c2', 'p9');
    fireEvent.click(backTo(/^Candidates/));
    expect(await within(table()).findByText('Suggestion')).toBeTruthy();
  });

  it('a suggested match that already has a person record links to it instead of creating one', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2', person_id: 'p5' })] : []);
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const master = card('Master record');
    fireEvent.click(await within(master).findByLabelText(/has a person record/));
    fireEvent.click(within(master).getByRole('button', { name: 'Link selected' }));
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledWith('c2', 'p5'));
    expect(people.createPerson).not.toHaveBeenCalled();
  });

  it('linking is disabled while the form has unsaved edits (linking reloads the record)', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    people.getPersons.mockResolvedValue({
      success: true,
      data: [{ id: 'p5', name: 'Anil Kumar', photo_url: null, gender: null, education: null, date_of_birth: null, candidate_count: 1, elections: [], state_id: null, state_name: null, region_id: null, region_name: null }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const master = card('Master record');
    const linkTo = await within(master).findByRole('button', { name: 'Link to Anil Kumar' });
    const linkSelected = await within(master).findByRole('button', { name: 'Link selected' });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    expect((linkTo as HTMLButtonElement).disabled).toBe(true);
    expect((linkSelected as HTMLButtonElement).disabled).toBe(true);
    expect((within(master).getByRole('button', { name: 'Create new person record' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(master).getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('"Create new person record" creates one with the candidate name and links it', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.click(within(card('Master record')).getByRole('button', { name: 'Create new person record' }));
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledWith('c2', 'p9'));
    expect(people.createPerson).toHaveBeenCalledWith('Anil Kumar');
  });

  it('saving the form keeps the ticked same-name suggestions', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const box = (await within(card('Master record')).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/)) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    const searches = svc.searchCandidates.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.click(save());
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    await waitFor(() => expect(svc.searchCandidates.mock.calls.length).toBeGreaterThan(searches));
    await new Promise((r) => setTimeout(r, 0));
    expect((within(card('Master record')).getByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/) as HTMLInputElement).checked).toBe(true);
  });

  it('"Link selected" is disabled while linking, so a double click creates one person', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    let release!: () => void;
    svc.linkCandidatePerson.mockImplementationOnce(() => new Promise((r) => { release = () => r({}); }));
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const master = card('Master record');
    fireEvent.click(await within(master).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    const btn = within(master).getByRole('button', { name: 'Link selected' }) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn.disabled).toBe(true));
    fireEvent.click(btn);
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledTimes(1));
    release();
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledWith('old', 'p9'));
    expect(people.createPerson).toHaveBeenCalledTimes(1);
  });

  it('after a failed reload, "Try again" is disabled while the form has unsaved edits', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.click(await within(card('Master record')).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    svc.getCandidate.mockRejectedValueOnce(new ApiError('boom', 500));
    fireEvent.click(within(card('Master record')).getByRole('button', { name: 'Link selected' }));
    expect(await screen.findByText('Could not reload candidate')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    const alert = screen.getByText('Could not reload candidate').closest('[role="alert"]')!;
    expect((within(alert as HTMLElement).getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('New candidate', () => {
  beforeEach(() => {
    let n = 0;
    svc.createCandidate.mockImplementation(async (body: Record<string, unknown>) => {
      const created = cand(`new-${++n}`, body.name as string, body.const_id as string, {
        party_id: (body.party_id as string | null) ?? null, party: null, metadata: body.metadata as Record<string, unknown>,
      });
      ROWS[created.const_id].push(created);
      return created;
    });
  });

  const openCreate = async () => {
    renderAt();
    await within(table()).findByText('Ravi Prasad');
    fireEvent.click(screen.getByRole('button', { name: 'New candidate' }));
    expect(where()).toBe('/candidates/new');
    return screen.findByRole('dialog', { name: 'New candidate' });
  };

  it('opens a dialog over the list, defaults to the selected seat; Enter submits; the new record page opens', async () => {
    const dialog = await openCreate();
    // The list stays behind the modal (hidden from the accessibility tree while it is open).
    expect(screen.getByRole('table', { name: 'Candidates', hidden: true })).toBeTruthy();
    expect((within(dialog).getByRole('combobox', { name: 'Seat' }) as HTMLInputElement).value).toBe('1 Valmiki Nagar');
    const name = within(dialog).getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Sunita Devi' } });
    fireEvent.change(within(dialog).getByLabelText('Party'), { target: { value: 'BJP' } });
    fireEvent.change(within(dialog).getByLabelText('Age'), { target: { value: '39' } });
    fireEvent.change(within(dialog).getByLabelText('Criminal cases'), { target: { value: '0' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(svc.createCandidate).toHaveBeenCalledWith({
      election_id: 'e1', const_id: 's1', name: 'Sunita Devi', party_id: 'BJP',
      metadata: { age: 39, gender: null, education: null, criminal_cases: 0, assets: null },
    }));
    await waitFor(() => expect(where()).toBe('/candidates/new-1'));
    expect(await record('Sunita Devi')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(backTo('Candidates · 1 Valmiki Nagar'));
    expect(await within(table()).findByText('Sunita Devi')).toBeTruthy();
  });

  it('Independent sends the IND party; a seat picked in the dialog switches the Seat select to it', async () => {
    const dialog = await openCreate();
    const seat = within(dialog).getByRole('combobox', { name: 'Seat' });
    fireEvent.focus(seat);
    fireEvent.change(seat, { target: { value: 'Patna' } });
    fireEvent.keyDown(seat, { key: 'Enter' });
    expect((seat as HTMLInputElement).value).toBe('142 Patna Sahib');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Rekha Singh' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create candidate' }));
    await waitFor(() => expect(svc.createCandidate).toHaveBeenCalledWith(expect.objectContaining({ const_id: 's142', name: 'Rekha Singh', party_id: 'IND' })));
    await waitFor(() => expect(where()).toBe('/candidates/new-1'));
    await record('Rekha Singh');
    fireEvent.click(backTo('Candidates · 142 Patna Sahib'));
    await waitFor(() => expect(seatInput().value).toBe('142 Patna Sahib'));
    expect(await within(table()).findByText('Rekha Singh')).toBeTruthy();
  });

  it('a non-numeric criminal cases value shows an error and blocks Create', async () => {
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Rekha Singh' } });
    fireEvent.change(within(dialog).getByLabelText('Criminal cases'), { target: { value: 'two' } });
    expect(within(dialog).getByText('Enter a whole number')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Create candidate' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(within(dialog).getByLabelText('Name').closest('form')!);
    expect(svc.createCandidate).not.toHaveBeenCalled();
  });

  it('a Finalized election disables "New candidate", and /candidates/new says why instead of showing the form', async () => {
    ctx.electionId = 'e2';
    renderAt();
    await waitFor(() => expect(seatInput().value).toBe('5 Kochi'));
    const btn = screen.getByRole('button', { name: 'New candidate' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTitle("Archived elections can't get new candidates")).toBeTruthy();
    cleanup();
    renderAt('/candidates/new');
    const dialog = await screen.findByRole('dialog', { name: 'New candidate' });
    expect(within(dialog).getByText("Archived elections can't get new candidates")).toBeTruthy();
    expect(within(dialog).queryByLabelText('Name')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Create candidate' })).toBeNull();
  });
});
