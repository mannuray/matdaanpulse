// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Candidate } from '../types';

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

beforeEach(() => {
  ctx.electionId = 'e1';
  svc.getCandidates.mockImplementation(async (_e: string, cid: string) => ROWS[cid] ?? []);
  svc.getCandidate.mockImplementation(async (id: string) => {
    const c = Object.values(ROWS).flat().find((x) => x.id === id) ?? OTHER[id as 'k1'];
    const constituency = Object.values(data.seats).flat().find((s) => s.id === c.const_id);
    return { ...c, constituency };
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

describe('Candidates page', () => {
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

  it('opening an unlinked candidate pre-fills the person search; Save sends no photo_url', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Anil Kumar'));
    expect(where()).toBe('/candidates/c2');
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    await waitFor(() => expect((within(panel).getByLabelText('Find a person') as HTMLInputElement).value).toBe('Anil Kumar'));
    await waitFor(() => expect(people.getPersons).toHaveBeenCalledWith(1, 10, 'Anil Kumar'));
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    const [id, payload] = svc.updateCandidate.mock.calls[0];
    expect(id).toBe('c2');
    expect(payload).not.toHaveProperty('photo_url');
    expect(payload.metadata).toEqual(expect.objectContaining({ age: 45, criminal_cases: 2 }));
  });

  it('a deep link to a candidate in another seat switches the Seat select to it', async () => {
    renderAt('/candidates/c9');
    await screen.findByRole('dialog', { name: 'Priya Kumari' });
    await waitFor(() => expect(seatInput().value).toBe('142 Patna Sahib'));
    const row = (await within(table()).findByText('Priya Kumari')).closest('tr')!;
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's142');
  });

  it('a candidate from another election offers "Switch election"', async () => {
    renderAt('/candidates/k1');
    const panel = await screen.findByRole('dialog', { name: 'Thomas Isaac' });
    expect(within(panel).getByText(/This record is in Kerala VS 2021/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch election' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e2');
  });

  it('same-name suggestions show in the panel (not the table) and link the checked matches', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    renderAt('/candidates/c2');
    expect(await within(table()).findByText('Suggestion')).toBeTruthy();
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    fireEvent.click(await within(panel).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    fireEvent.click(within(panel).getByRole('button', { name: 'Link selected' }));
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledWith('old', 'p9'));
    expect(people.createPerson).toHaveBeenCalledWith('Anil Kumar');
    expect(svc.linkCandidatePerson).toHaveBeenCalledWith('c2', 'p9');
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
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    const linkTo = await within(panel).findByRole('button', { name: 'Link to Anil Kumar' });
    const linkSelected = await within(panel).findByRole('button', { name: 'Link selected' });
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
    expect((linkTo as HTMLButtonElement).disabled).toBe(true);
    expect((linkSelected as HTMLButtonElement).disabled).toBe(true);
    expect((within(panel).getByRole('button', { name: 'Create new person record' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('Unlink is disabled while a linked candidate has unsaved edits; a cancelled unlink does not refresh the table', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c1');
    const panel = await screen.findByRole('dialog', { name: 'Ravi Prasad' });
    const unlink = await within(panel).findByRole('button', { name: 'Unlink' });
    await waitFor(() => expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1'));
    const calls = svc.getCandidates.mock.calls.length;
    fireEvent.click(unlink);
    expect(confirm).toHaveBeenCalledWith('Unlink from master record?');
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.unlinkCandidatePerson).not.toHaveBeenCalled();
    expect(svc.getCandidates.mock.calls.length).toBe(calls);
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '51' } });
    expect((unlink as HTMLButtonElement).disabled).toBe(true);
  });

  it('a stored candidate without a party shows Independent (listed once, first) and stays clean; Save writes IND', async () => {
    const orig = ROWS.s1[1];
    ROWS.s1[1] = { ...orig, party_id: null, party: null };
    try {
      renderAt('/candidates/c2');
      const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
      const party = (await within(panel).findByLabelText('Party')) as HTMLSelectElement;
      await waitFor(() => expect(party.options.length).toBe(2));
      expect(Array.from(party.options).map((o) => o.textContent)).toEqual(['Independent', 'Bharatiya Janata Party']);
      expect(party.value).toBe('IND');
      expect(within(panel).getByText('No changes')).toBeTruthy();
      fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
      await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalledWith('c2', expect.objectContaining({ party_id: 'IND' })));
    } finally {
      ROWS.s1[1] = orig;
    }
  });

  it('saving the form keeps the ticked same-name suggestions', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    renderAt('/candidates/c2');
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    const box = (await within(panel).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/)) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    const searches = svc.searchCandidates.mock.calls.length;
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    await waitFor(() => expect(svc.searchCandidates.mock.calls.length).toBeGreaterThan(searches));
    await new Promise((r) => setTimeout(r, 0));
    expect((within(panel).getByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/) as HTMLInputElement).checked).toBe(true);
  });

  it('"Link selected" is disabled while linking, so a double click creates one person', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    let release!: () => void;
    svc.linkCandidatePerson.mockImplementationOnce(() => new Promise((r) => { release = () => r({}); }));
    renderAt('/candidates/c2');
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    fireEvent.click(await within(panel).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    const btn = within(panel).getByRole('button', { name: 'Link selected' }) as HTMLButtonElement;
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
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    fireEvent.click(await within(panel).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    svc.getCandidate.mockRejectedValueOnce(new ApiError('boom', 500));
    fireEvent.click(within(panel).getByRole('button', { name: 'Link selected' }));
    expect(await within(panel).findByText('Could not reload candidate')).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
    expect((within(panel).getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a closed panel no longer moves the Seat select on a later election switch', async () => {
    renderAt('/candidates/c9');
    await screen.findByRole('dialog', { name: 'Priya Kumari' });
    await waitFor(() => expect(seatInput().value).toBe('142 Patna Sahib'));
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(where()).toBe('/candidates');
    act(() => ctx.setElectionId('e2'));
    await waitFor(() => expect(seatInput().value).toBe('5 Kochi'));
    act(() => ctx.setElectionId('e1'));
    await waitFor(() => expect(seatInput().value).toBe('1 Valmiki Nagar'));
  });

  it('"Open person" asks before leaving a panel with unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c1');
    const panel = await screen.findByRole('dialog', { name: 'Ravi Prasad' });
    fireEvent.change(await within(panel).findByLabelText('Age'), { target: { value: '51' } });
    fireEvent.click(within(panel).getByRole('link', { name: /Open person/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/candidates/c1');
  });

  it('a non-numeric age shows an inline error and blocks Save', async () => {
    renderAt('/candidates/c2');
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    fireEvent.change(await within(panel).findByLabelText('Age'), { target: { value: 'forty' } });
    expect(within(panel).getByText('Enter a whole number')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '44' } });
    expect(within(panel).queryByText('Enter a whole number')).toBeNull();
  });

  it('a deep link to an unknown candidate says "Candidate not found"', async () => {
    svc.getCandidate.mockRejectedValueOnce(new ApiError('Candidate not found', 404));
    renderAt('/candidates/00000000-0000-0000-0000-000000000000');
    expect(await within(await screen.findByRole('dialog')).findByText('Candidate not found')).toBeTruthy();
  });

  it('a non-404 load failure says "Could not load candidate" and Try again reloads', async () => {
    svc.getCandidate.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/candidates/c2');
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findByText('Could not load candidate')).toBeTruthy();
    expect(within(panel).queryByText('Candidate not found')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Try again' }));
    expect(((await within(panel).findByLabelText('Name')) as HTMLInputElement).value).toBe('Anil Kumar');
  });

  it('"Switch election" on a record of another election shows its seat in that election', async () => {
    renderAt('/candidates/k1');
    const panel = await screen.findByRole('dialog', { name: 'Thomas Isaac' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch election' }));
    await waitFor(() => expect(seatInput().value).toBe('5 Kochi'));
    expect(within(panel).queryByText(/This record is in/)).toBeNull();
    expect(svc.getCandidates).toHaveBeenCalledWith('e2', 'k5');
    expect(svc.getCandidates).not.toHaveBeenCalledWith('e2', 's1');
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

  it('a Finalized election disables "New candidate", and /candidates/new says why instead of showing the form', async () => {
    ctx.electionId = 'e2';
    renderAt();
    await waitFor(() => expect(seatInput().value).toBe('5 Kochi'));
    const btn = screen.getByRole('button', { name: 'New candidate' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTitle("Archived elections can't get new candidates")).toBeTruthy();
    cleanup();
    renderAt('/candidates/new');
    const panel = await screen.findByRole('dialog', { name: 'New candidate' });
    expect(within(panel).getByText("Archived elections can't get new candidates")).toBeTruthy();
    expect(within(panel).queryByLabelText('Name')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Create candidate' })).toBeNull();
  });

  it('"Switch election" asks before dropping unsaved edits, like the top-bar picker', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/k1');
    const panel = await screen.findByRole('dialog', { name: 'Thomas Isaac' });
    fireEvent.change(await within(panel).findByLabelText('Age'), { target: { value: '61' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch election' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(ctx.setElectionId).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch election' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e2');
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

    it('defaults to the selected seat; Enter submits; the new record opens and joins the table', async () => {
      const panel = await openCreate();
      expect((within(panel).getByRole('combobox', { name: 'Seat' }) as HTMLInputElement).value).toBe('1 Valmiki Nagar');
      const name = within(panel).getByLabelText('Name');
      fireEvent.change(name, { target: { value: 'Sunita Devi' } });
      fireEvent.change(within(panel).getByLabelText('Party'), { target: { value: 'BJP' } });
      fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '39' } });
      fireEvent.change(within(panel).getByLabelText('Criminal cases'), { target: { value: '0' } });
      fireEvent.submit(name.closest('form')!);
      await waitFor(() => expect(svc.createCandidate).toHaveBeenCalledWith({
        election_id: 'e1', const_id: 's1', name: 'Sunita Devi', party_id: 'BJP',
        metadata: { age: 39, gender: null, education: null, criminal_cases: 0, assets: null },
      }));
      await waitFor(() => expect(where()).toBe('/candidates/new-1'));
      expect(await screen.findByRole('dialog', { name: 'Sunita Devi' })).toBeTruthy();
      expect(await within(table()).findByText('Sunita Devi')).toBeTruthy();
    });

    it('Independent sends the IND party; a seat picked in the panel switches the Seat select to it', async () => {
      const panel = await openCreate();
      const seat = within(panel).getByRole('combobox', { name: 'Seat' });
      fireEvent.focus(seat);
      fireEvent.change(seat, { target: { value: 'Patna' } });
      fireEvent.keyDown(seat, { key: 'Enter' });
      expect((seat as HTMLInputElement).value).toBe('142 Patna Sahib');
      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Rekha Singh' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Create candidate' }));
      await waitFor(() => expect(svc.createCandidate).toHaveBeenCalledWith(expect.objectContaining({ const_id: 's142', name: 'Rekha Singh', party_id: 'IND' })));
      await waitFor(() => expect(where()).toBe('/candidates/new-1'));
      await waitFor(() => expect(seatInput().value).toBe('142 Patna Sahib'));
      expect(await within(table()).findByText('Rekha Singh')).toBeTruthy();
    });

    it('a non-numeric criminal cases value shows an error and blocks Create', async () => {
      const panel = await openCreate();
      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Rekha Singh' } });
      fireEvent.change(within(panel).getByLabelText('Criminal cases'), { target: { value: 'two' } });
      expect(within(panel).getByText('Enter a whole number')).toBeTruthy();
      expect((within(panel).getByRole('button', { name: 'Create candidate' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.submit(within(panel).getByLabelText('Name').closest('form')!);
      expect(svc.createCandidate).not.toHaveBeenCalled();
    });
  });
});
