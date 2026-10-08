// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Candidate, CandidateResult, SeatRow } from '../types';

const data = vi.hoisted(() => {
  const seat = (id: string, const_no: number, name: string, election_id = 'e1') => ({ id, election_id, name, const_no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {} });
  return {
    seats: { e1: [seat('s142', 142, 'Patna Sahib'), seat('s1', 1, 'Valmiki Nagar')], e2: [seat('k5', 5, 'Kochi', 'e2')] } as Record<string, ReturnType<typeof seat>[]>,
    elections: [
      { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_published: false },
      { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Finalized', state_id: 2, tentative_next_date: null, manifest_published: false },
    ],
  };
});
const svc = vi.hoisted(() => ({
  getCandidates: vi.fn(),
  getCandidate: vi.fn(),
  searchCandidates: vi.fn(async (_q: string): Promise<unknown[]> => []),
  updateCandidate: vi.fn(async (_id: string, _data: Record<string, unknown>) => ({})),
  changeCandidatePerson: vi.fn(async (_c: string, _p: string) => ({})),
  splitCandidate: vi.fn(async (_c: string) => ({ person_id: 'p-split', old_person_deleted: false })),
  createCandidate: vi.fn(),
  getCandidateResult: vi.fn(),
}));
vi.mock('../services/candidate.service', () => svc);
const people = vi.hoisted(() => ({
  getPersons: vi.fn(async (..._args: unknown[]) => ({ success: true, data: [] as unknown[], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
}));
vi.mock('../services/person.api', () => people);
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async (eid: string) => data.seats[eid] ?? []) }));
vi.mock('../services/party.service', () => ({ getParties: vi.fn(async () => [{ id: 'BJP', name: 'Bharatiya Janata Party' }, { id: 'IND', name: 'Independent' }]) }));
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

/** Every candidate has a person (migration 018): by default an auto-created one with the ballot name and this one contest. */
const cand = (id: string, name: string, const_id: string, over: Partial<Candidate> = {}): Candidate => ({
  id, person_id: `p-${id}`, person: { id: `p-${id}`, name, photo_url: null, gender: null, education: null, date_of_birth: null },
  person_contests: { contests: 1, first_year: 2025 },
  election_id: 'e1', const_id, party_id: 'BJP',
  party: { id: 'BJP', name: 'Bharatiya Janata Party', color: '#f59e0b', abbreviation: 'BJP' } as Candidate['party'],
  name, is_incumbent: false, age: 50, assets: null, liabilities: null, criminal_cases: 0, ...over,
});
const person = (id: string, name: string, candidate_count = 1, elections: string[] = []) => ({
  id, name, photo_url: null, gender: null, education: null, date_of_birth: null, candidate_count, elections,
  state_id: null, state_name: null, region_id: null, region_name: null,
});
const personsPage = (rows: ReturnType<typeof person>[]) => ({ success: true, data: rows as unknown[], pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });
const ROWS: Record<string, Candidate[]> = {
  s1: [
    cand('c1', 'Ravi Prasad', 's1', {
      person_id: 'p1', person: { id: 'p1', name: 'Ravi Shankar Prasad', photo_url: null, gender: 'Male', education: null, date_of_birth: null },
      person_contests: { contests: 3, first_year: 2010 },
    }),
    cand('c2', 'Anil Kumar', 's1', { age: 44, criminal_cases: 2 }),
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
  it('uses the global election, defaults to the lowest seat, hides NOTA; age and cases come from the affidavit columns', async () => {
    renderAt();
    expect(await within(table()).findByText('Ravi Prasad')).toBeTruthy();
    expect(within(table()).queryByText('NOTA')).toBeNull();
    expect(seatInput().value).toBe('1 Valmiki Nagar');
    expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1');
    const anil = within(table()).getByText('Anil Kumar').closest('tr')!;
    expect(within(anil).getByText('44')).toBeTruthy();
    expect(within(anil).getByText('2')).toBeTruthy();
    // Every candidate has a person: there is no link-state filter or column any more.
    expect(screen.queryByRole('group', { name: 'Person link' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/unlink/i);
  });

  it('unknown age and cases show a dash, not 0', async () => {
    const orig = ROWS.s1[1];
    ROWS.s1[1] = { ...orig, age: null, criminal_cases: null };
    try {
      renderAt();
      const anil = (await within(table()).findByText('Anil Kumar')).closest('tr')!;
      expect(within(anil).getAllByText('–')).toHaveLength(2);
    } finally {
      ROWS.s1[1] = orig;
    }
  });

  it('?seat= preselects that seat (the constituency record links here); an unknown seat falls back to the lowest', async () => {
    renderAt('/candidates?election=e1&seat=s142');
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's142'));
    expect(seatInput().value).toBe('142 Patna Sahib');
    expect(svc.getCandidates).not.toHaveBeenCalledWith('e1', 's1');
    // Used once, then dropped from the URL, so a reload or a copied link never brings back a seat picked over.
    await waitFor(() => expect(where()).toBe('/candidates?election=e1'));
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

  it('the Affidavit card has only age, assets, liabilities and criminal cases; Save sends them as top-level numbers', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const affidavit = card('Affidavit');
    expect(within(affidavit).getAllByRole('textbox')).toHaveLength(4);
    for (const l of ['Age', 'Declared assets', 'Declared liabilities', 'Criminal cases']) expect(within(affidavit).getByLabelText(l)).toBeTruthy();
    expect(screen.queryByLabelText('Gender')).toBeNull();
    expect(screen.queryByLabelText('Education')).toBeNull();
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Declared liabilities'), { target: { value: '0' } });
    fireEvent.click(save());
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    const [id, payload] = svc.updateCandidate.mock.calls[0];
    expect(id).toBe('c2');
    // Exactly the whitelisted keys (the backend refuses metadata, gender, education, person_id, photo_url).
    expect(payload).toEqual({ name: 'Anil Kumar', party_id: 'BJP', is_incumbent: false, age: 45, assets: null, liabilities: 0, criminal_cases: 2 });
  });

  it('a stored 0 shows as 0 (not blank) and stays 0 on save', async () => {
    const orig = ROWS.s1[1];
    ROWS.s1[1] = { ...orig, assets: 0, criminal_cases: 0 };
    try {
      renderAt('/candidates/c2');
      await record('Anil Kumar');
      expect((screen.getByLabelText('Declared assets') as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText('Criminal cases') as HTMLInputElement).value).toBe('0');
      fireEvent.change(screen.getByLabelText('Age'), { target: { value: '46' } });
      fireEvent.click(save());
      await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalledWith('c2', expect.objectContaining({ assets: 0, criminal_cases: 0, liabilities: null })));
    } finally {
      ROWS.s1[1] = orig;
    }
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
    expect(payload).toEqual(expect.objectContaining({ age: null, assets: null, liabilities: null, criminal_cases: 2 }));
  });

  it('declared assets show the rupee value in Indian grouping with crore or lakh', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Declared assets'), { target: { value: '24500000' } });
    expect(screen.getByText('₹2,45,00,000 · ₹2.45 crore')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Declared assets'), { target: { value: '8500000' } });
    expect(screen.getByText('₹85,00,000 · ₹85 lakh')).toBeTruthy();
  });

  it('declared liabilities use the same crore / lakh helper; rupee text with ₹ and commas is saved as a number', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Declared liabilities'), { target: { value: '₹12,50,000' } });
    expect(screen.getByText('₹12,50,000 · ₹12.5 lakh')).toBeTruthy();
    fireEvent.click(save());
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalledWith('c2', expect.objectContaining({ liabilities: 1250000 })));
  });

  it('decimal or text assets show an inline error and block Save', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Declared assets'), { target: { value: '2.5 crore' } });
    expect(screen.getByText('Enter whole rupees')).toBeTruthy();
    expect(save().disabled).toBe(true);
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

  it('an id the server cannot parse (400) says "Candidate not found", with no retry and no toast', async () => {
    svc.getCandidate.mockRejectedValueOnce(new ApiError('Validation failed (uuid is expected)', 400));
    renderAt('/candidates/abc');
    const alert = await screen.findByRole('alert');
    expect(await within(alert).findByText('Candidate not found')).toBeTruthy();
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByText('Failed to load candidate data')).toBeNull();
  });

  it('shows server field errors under the field', async () => {
    svc.updateCandidate.mockRejectedValueOnce(new ApiError('Validation failed', 400, 'VALIDATION', [
      { field: 'name', message: 'name must be shorter than or equal to 255 characters' },
      { field: 'party_id', message: 'party_id must be shorter than or equal to 20 characters' },
      { field: 'liabilities', message: 'liabilities must not be greater than 9007199254740991' },
    ]));
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Anil Kumar Singh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('name must be shorter than or equal to 255 characters')).toBeTruthy();
    expect(screen.getByText('party_id must be shorter than or equal to 20 characters')).toBeTruthy();
    expect(within(card('Affidavit')).getByText('liabilities must not be greater than 9007199254740991')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('name must be shorter than or equal to 255 characters')).toBeNull();
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
  const master = () => card('Master record');
  const dialog = (name: string) => screen.findByRole('dialog', { name });
  /** The Change person search answers with these persons (limit 10); the duplicates lookup (limit 20) with `dupes`. */
  const mockPersons = (search: ReturnType<typeof person>[], dupes: ReturnType<typeof person>[] = []) => {
    people.getPersons.mockImplementation(async (...args: unknown[]) => personsPage(args[1] === 20 ? dupes : search));
  };

  it('always shows the person: name, "N contests · first YYYY" and "Open person", which asks before leaving unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    expect(within(master()).getByText('Ravi Shankar Prasad')).toBeTruthy();
    expect(within(master()).getByText('3 contests · first 2010')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '51' } });
    fireEvent.click(within(master()).getByRole('link', { name: /Open person/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/candidates/c1');
  });

  it('has no unlink, "create master record" or "Link selected" UI', async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    expect(document.body.textContent).not.toMatch(/unlink/i);
    expect(within(master()).queryByRole('button', { name: 'Create new person record' })).toBeNull();
    expect(within(master()).queryByRole('button', { name: 'Link selected' })).toBeNull();
    expect(within(master()).queryByRole('checkbox')).toBeNull();
  });

  it('Change person searches persons (not the current one), asks first, and moves the contest; the list refreshes', async () => {
    mockPersons([person('p1', 'Ravi Shankar Prasad', 3), person('p5', 'Ravi S. Prasad', 2)]);
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1'));
    const lists = svc.getCandidates.mock.calls.length;
    fireEvent.click(within(master()).getByRole('button', { name: 'Change person' }));
    fireEvent.change(within(master()).getByLabelText('Find a person'), { target: { value: 'Ravi' } });
    const move = await within(master()).findByRole('button', { name: 'Move to Ravi S. Prasad' });
    expect(within(master()).queryByRole('button', { name: 'Move to Ravi Shankar Prasad' })).toBeNull();
    expect(people.getPersons).toHaveBeenCalledWith(1, 10, 'Ravi');
    fireEvent.click(move);
    const confirm = await dialog('Change person?');
    expect(within(confirm).getByText('This contest moves to Ravi S. Prasad.')).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Move contest' }));
    await waitFor(() => expect(svc.changeCandidatePerson).toHaveBeenCalledWith('c1', 'p5'));
    await waitFor(() => expect(svc.getCandidates.mock.calls.length).toBeGreaterThan(lists));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling the Change person confirm changes nothing', async () => {
    mockPersons([person('p5', 'Ravi S. Prasad', 2)]);
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    fireEvent.click(within(master()).getByRole('button', { name: 'Change person' }));
    fireEvent.change(within(master()).getByLabelText('Find a person'), { target: { value: 'Ravi' } });
    fireEvent.click(await within(master()).findByRole('button', { name: 'Move to Ravi S. Prasad' }));
    fireEvent.click(within(await dialog('Change person?')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(svc.changeCandidatePerson).not.toHaveBeenCalled();
  });

  it("Change person on a person's only contest says it merges, then shows the merge", async () => {
    mockPersons([person('p5', 'Anil Kumar Singh', 2)]);
    svc.changeCandidatePerson.mockImplementationOnce(async () => ({ merge_id: 'm1' }));
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    fireEvent.click(within(master()).getByRole('button', { name: 'Change person' }));
    fireEvent.change(within(master()).getByLabelText('Find a person'), { target: { value: 'Anil' } });
    fireEvent.click(await within(master()).findByRole('button', { name: 'Move to Anil Kumar Singh' }));
    const confirm = await dialog('Change person?');
    expect(within(confirm).getByText(
      "This contest moves to Anil Kumar Singh. It is Anil Kumar's only contest, so Anil Kumar is merged into Anil Kumar Singh: "
      + "its details fill any empty fields there, and a super admin can undo the merge from Anil Kumar Singh's merge history.",
    )).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Move and merge' }));
    await waitFor(() => expect(svc.changeCandidatePerson).toHaveBeenCalledWith('c2', 'p5'));
    expect(await screen.findByText(
      "Merged Anil Kumar into Anil Kumar Singh. A super admin can undo it from Anil Kumar Singh's merge history.",
    )).toBeTruthy();
  });

  it('Split asks first, moves the contest to a new person and then shows it', async () => {
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    const split = within(master()).getByRole('button', { name: 'Split into new person' }) as HTMLButtonElement;
    expect(split.disabled).toBe(false);
    // After the split the record reloads with its new person (named from the ballot).
    const orig = ROWS.s1[0];
    svc.splitCandidate.mockImplementationOnce(async () => {
      ROWS.s1[0] = { ...orig, person_id: 'p-split', person: { id: 'p-split', name: 'Ravi Prasad', photo_url: null, gender: null, education: null, date_of_birth: null }, person_contests: { contests: 1, first_year: 2025 } };
      return { person_id: 'p-split', old_person_deleted: false };
    });
    try {
      fireEvent.click(split);
      const confirm = await dialog('Split into new person?');
      expect(within(confirm).getByText('This contest moves to a new person record.')).toBeTruthy();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Split' }));
      await waitFor(() => expect(svc.splitCandidate).toHaveBeenCalledWith('c1'));
      await waitFor(() => expect(within(master()).getByRole('link', { name: /Open person/ }).getAttribute('href')).toBe('/persons/p-split'));
      expect(within(master()).getByText('1 contest · first 2025')).toBeTruthy();
      expect(within(master()).queryByText('Ravi Shankar Prasad')).toBeNull();
    } finally {
      ROWS.s1[0] = orig;
    }
  });

  it("Split is disabled on the person's only contest (the backend refuses it with 409)", async () => {
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    expect((within(master()).getByRole('button', { name: 'Split into new person' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(master()).getByText("This is the person's only contest, so there is nothing to split.")).toBeTruthy();
  });

  it('a refused split shows the server message', async () => {
    svc.splitCandidate.mockRejectedValueOnce(new ApiError("This is the person's only contest", 409));
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    fireEvent.click(within(master()).getByRole('button', { name: 'Split into new person' }));
    fireEvent.click(within(await dialog('Split into new person?')).getByRole('button', { name: 'Split' }));
    expect(await screen.findByText("Split failed: This is the person's only contest")).toBeTruthy();
  });

  it('Possible duplicates: same-name persons other than this one, each linking to that person (where merge lives)', async () => {
    mockPersons([], [
      person('p-c2', 'Anil Kumar', 1),
      person('p7', 'ANIL KUMAR', 2, ['Bihar Vidhan Sabha 2020', 'Bihar Vidhan Sabha 2015']),
      person('p8', 'Anil Kumar Singh', 1),
    ]);
    renderAt('/candidates/c2');
    await record('Anil Kumar');
    const link = await within(master()).findByRole('link', { name: /ANIL KUMAR/ });
    expect(within(master()).getByText('Possible duplicates')).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/persons/p7');
    expect(link.textContent).toContain('2 contests');
    expect(within(master()).queryByRole('link', { name: /Anil Kumar Singh/ })).toBeNull();
    expect(people.getPersons).toHaveBeenCalledWith(1, 20, 'Anil Kumar');
    fireEvent.click(link);
    expect(where()).toBe('/persons/p7');
  });

  it('every action is disabled while the form has unsaved edits (they reload the record)', async () => {
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    expect((within(master()).getByRole('button', { name: 'Change person' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(master()).getByRole('button', { name: 'Split into new person' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(master()).getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('after a failed reload, "Try again" is disabled while the form has unsaved edits', async () => {
    renderAt('/candidates/c1');
    await record('Ravi Prasad');
    svc.getCandidate.mockRejectedValueOnce(new ApiError('boom', 500));
    fireEvent.click(within(master()).getByRole('button', { name: 'Split into new person' }));
    fireEvent.click(within(await dialog('Split into new person?')).getByRole('button', { name: 'Split' }));
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
      // The backend creates the person (AFTER INSERT trigger): name = ballot name.
      const created = cand(`new-${++n}`, body.name as string, body.const_id as string, {
        party_id: (body.party_id as string | null) ?? null, party: null,
        age: body.age as number | null, assets: body.assets as number | null, liabilities: body.liabilities as number | null,
        criminal_cases: body.criminal_cases as number | null,
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
      age: 39, assets: null, liabilities: null, criminal_cases: 0,
    }));
    await waitFor(() => expect(where()).toBe('/candidates/new-1'));
    expect(await record('Sunita Devi')).toBeTruthy();
    // Review focus 5: the new candidate already has a person (created by the backend).
    const master = card('Master record');
    expect(within(master).getByText('Sunita Devi')).toBeTruthy();
    expect(within(master).getByRole('link', { name: /Open person/ }).getAttribute('href')).toBe('/persons/p-new-1');
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
