// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ElectionProvider, useElection, pickInitialElection, ELECTION_STORAGE_KEY } from './ElectionContext';
import { getElections } from '../services/election.service';
import type { Election } from '../types';

const e = (id: string, status: Election['status'] = 'Finalized'): Election => ({
  id, name: id, type: 'VS', state_id: 1, year: 2025, status, tentative_next_date: null, manifest_url: null,
});

vi.mock('../services/election.service', () => ({ getElections: vi.fn(async () => [e('a'), e('b', 'Live')]) }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe('pickInitialElection', () => {
  const list = [e('a'), e('b', 'Live')];
  it('URL wins when valid', () => expect(pickInitialElection(list, 'a', 'b')).toBe('a'));
  it('then storage', () => expect(pickInitialElection(list, 'zzz', 'a')).toBe('a'));
  it('then first Live', () => expect(pickInitialElection(list, null, null)).toBe('b'));
  it('then first', () => expect(pickInitialElection([e('a')], null, null)).toBe('a'));
  it('empty list → empty', () => expect(pickInitialElection([], null, null)).toBe(''));
});

function Probe() {
  const { electionId, setElectionId, error } = useElection();
  return <><span data-testid="id">{electionId}</span><span data-testid="error">{error}</span><button onClick={() => setElectionId('a')}>pick a</button></>;
}

describe('ElectionProvider', () => {
  it('defaults to the live election and persists a change', async () => {
    render(<MemoryRouter><ElectionProvider><Probe /></ElectionProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b'));
    act(() => screen.getByText('pick a').click());
    expect(screen.getByTestId('id').textContent).toBe('a');
    expect(localStorage.getItem(ELECTION_STORAGE_KEY)).toBe('a');
  });

  it('sets error when getElections fails', async () => {
    vi.mocked(getElections).mockRejectedValueOnce(new Error('Network error'));
    render(<MemoryRouter><ElectionProvider><Probe /></ElectionProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Could not load elections'));
    expect(screen.getByTestId('id').textContent).toBe('');
  });
});
