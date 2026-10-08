// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import * as electionApi from '../../model/api/election.service';
import { useDefaultElectionId } from '../tiles/useDefaultElectionId';
import { forgetElectionList } from '../data/useElectionList';

const el = (id: string, type: 'LS' | 'VS', year: number) => ({ id, name: id, type, year, state_id: null, state: null, status: 'Finalized', tentative_next_date: null, manifest_url: null });

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>;
}

async function run(list: unknown[]) {
  vi.spyOn(electionApi, 'getElections').mockResolvedValue(list as never);
  const hook = renderHook(() => useDefaultElectionId(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook.result.current.id;
}

beforeEach(() => { localStorage.clear(); forgetElectionList(); });
afterEach(() => { vi.restoreAllMocks(); });

const LIST = [el('ls2019', 'LS', 2019), el('ls2024', 'LS', 2024), el('br2025', 'VS', 2025)];

describe('useDefaultElectionId', () => {
  it('prefers the remembered LS election', async () => {
    localStorage.setItem('lastElection_LS', 'ls2019');
    expect(await run(LIST)).toBe('ls2019');
  });
  it('falls back to the latest LS election', async () => {
    expect(await run(LIST)).toBe('ls2024');
  });
  it('falls back to the latest election of any type when no LS exists', async () => {
    expect(await run([el('br2020', 'VS', 2020), el('br2025', 'VS', 2025)])).toBe('br2025');
  });
  it('prefers a Finalized LS election over a later Upcoming one', async () => {
    expect(await run([{ ...el('ls2029', 'LS', 2029), status: 'Upcoming' }, el('ls2024', 'LS', 2024)])).toBe('ls2024');
  });
  it('picks an Upcoming election when only Upcoming exist', async () => {
    expect(await run([{ ...el('ls2029', 'LS', 2029), status: 'Upcoming' }])).toBe('ls2029');
  });
  it('returns null for an empty list', async () => {
    expect(await run([])).toBeNull();
  });
});
