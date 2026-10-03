// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';
import { useIngestFeed } from './useIngestFeed';

vi.mock('../services/ingest.service', () => ({
  getIngestStatus: vi.fn(async () => ({ election_id: 'e', status: 'Live', active_source: 'eci-web', hold_minutes: 10, shards: [], alerts: [] })),
  getSources: vi.fn(async () => ['eci-web', 'news']),
  putFeedSettings: vi.fn(async (_e: string, b: any) => ({ election_id: 'e', status: 'Live', ...b, shards: [], alerts: [] })),
}));
import * as svc from '../services/ingest.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('useIngestFeed', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loads status and sources, and saves settings', async () => {
    const { result } = renderHook(() => useIngestFeed('e'), { wrapper });
    await waitFor(() => expect(result.current.status?.active_source).toBe('eci-web'));
    expect(result.current.sources).toEqual(['eci-web', 'news']);
    await act(async () => { expect(await result.current.setFeed(null, 15)).toBe(true); });
    expect(svc.putFeedSettings).toHaveBeenCalledWith('e', { active_source: null, hold_minutes: 15 });
    expect(result.current.status?.active_source).toBeNull();
  });
  it('does nothing without an election', () => {
    renderHook(() => useIngestFeed(null), { wrapper });
    expect(svc.getIngestStatus).not.toHaveBeenCalled();
  });
  it('resets on election change and ignores a late answer for the old election', async () => {
    let releaseOld: (v: any) => void = () => {};
    (svc.getIngestStatus as any).mockImplementation((id: string) =>
      id === 'old' ? new Promise(r => { releaseOld = r; }) : Promise.resolve({ election_id: id, status: 'Live', active_source: 'news', hold_minutes: 10, shards: [], alerts: [] }));
    const { result, rerender } = renderHook(({ id }) => useIngestFeed(id), { wrapper, initialProps: { id: 'old' } });
    rerender({ id: 'new' });
    await waitFor(() => expect(result.current.status?.election_id).toBe('new'));
    await act(async () => { releaseOld({ election_id: 'old', status: 'Live', active_source: 'eci-web', hold_minutes: 10, shards: [], alerts: [] }); });
    expect(result.current.status?.election_id).toBe('new');
  });
});
