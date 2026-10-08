// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as electionApi from '../../model/api/election.service';
import { useElectionList, loadElectionList, forgetElectionList, ELECTION_LIST_TTL_MS } from '../data/useElectionList';

const LIST = [{ id: 'ls2024', type: 'LS', year: 2024 }];

beforeEach(() => { forgetElectionList(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('useElectionList (one /elections per page load)', () => {
  it('a later mount reuses the list an earlier one loaded (landing page, then dashboard)', async () => {
    const spy = vi.spyOn(electionApi, 'getElections').mockResolvedValue(LIST as never);
    const first = renderHook(() => useElectionList());
    await waitFor(() => expect(first.result.current.data).toEqual(LIST));
    first.unmount();
    const second = renderHook(() => useElectionList());
    await waitFor(() => expect(second.result.current.data).toEqual(LIST));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('simultaneous mounts share one request', async () => {
    const spy = vi.spyOn(electionApi, 'getElections').mockResolvedValue(LIST as never);
    const a = renderHook(() => useElectionList());
    const b = renderHook(() => useElectionList());
    await waitFor(() => expect(a.result.current.data).toEqual(LIST));
    await waitFor(() => expect(b.result.current.data).toEqual(LIST));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a failure is not cached: the next load (e.g. the top bar retry) hits the network', async () => {
    const spy = vi.spyOn(electionApi, 'getElections').mockRejectedValueOnce(new Error('429')).mockResolvedValue(LIST as never);
    await expect(loadElectionList()).rejects.toThrow('429');
    await expect(loadElectionList()).resolves.toEqual(LIST);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('the list is reloaded once it is older than the TTL', async () => {
    vi.useFakeTimers({ now: 1_000_000, shouldAdvanceTime: true });
    const spy = vi.spyOn(electionApi, 'getElections').mockResolvedValue(LIST as never);
    await loadElectionList();
    await loadElectionList();
    expect(spy).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000_000 + ELECTION_LIST_TTL_MS + 1);
    await loadElectionList();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refetch reloads instead of serving the cached list', async () => {
    const spy = vi.spyOn(electionApi, 'getElections').mockResolvedValue(LIST as never);
    const { result } = renderHook(() => useElectionList());
    await waitFor(() => expect(result.current.data).toEqual(LIST));
    result.current.refetch();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});
