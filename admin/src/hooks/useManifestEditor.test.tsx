// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/manifest.service', () => ({
  getManifest: vi.fn(async () => ({ draft: { alliances: [], milestones: [{ label: 'Majority', value: 272 }] }, manifest_url: null })),
  saveManifestDraft: vi.fn(async () => ({})),
  publishManifest: vi.fn(async () => ({})),
}));
vi.mock('../context/ElectionContext', () => ({ useElection: () => ({ elections: [] }) }));
vi.mock('../services/party.service', () => ({ getParties: vi.fn(async () => []) }));
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async () => []) }));
import { useManifestEditor } from './useManifestEditor';
import { saveManifestDraft, publishManifest, getManifest } from '../services/manifest.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

async function loaded() {
  const hook = renderHook(() => useManifestEditor('e1'), { wrapper });
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

describe('useManifestEditor save', () => {
  it('a save with no edits meanwhile makes the submitted manifest the clean snapshot', async () => {
    const { result } = await loaded();
    act(() => result.current.updateManifest('compare_with', ['2019']));
    expect(result.current.isDirty).toBe(true);
    await act(async () => { await result.current.saveDraft(result.current.manifest); });
    expect(saveManifestDraft).toHaveBeenCalledTimes(1);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.manifest.compare_with).toEqual(['2019']);
  });

  it('edits typed while a draft save is in flight are kept and stay dirty', async () => {
    const { result } = await loaded();
    act(() => result.current.updateManifest('compare_with', ['2019']));
    let release!: () => void;
    vi.mocked(saveManifestDraft).mockImplementationOnce(() => new Promise((r) => { release = () => r({} as never); }));
    let saving!: Promise<boolean>;
    const submitted = result.current.manifest;
    act(() => { saving = result.current.saveDraft(submitted); });
    act(() => result.current.updateManifest('compare_with', ['2019', '2014']));
    await act(async () => { release(); await saving; });
    expect(result.current.manifest.compare_with).toEqual(['2019', '2014']);
    expect(result.current.isDirty).toBe(true);
  });

  it('edits typed during a publish are not overwritten by the reload', async () => {
    const { result } = await loaded();
    let release!: () => void;
    vi.mocked(publishManifest).mockImplementationOnce(() => new Promise((r) => { release = () => r({} as never); }));
    let publishing!: Promise<boolean>;
    act(() => { publishing = result.current.publish(); });
    act(() => result.current.updateManifest('compare_with', ['2019']));
    vi.mocked(getManifest).mockClear();
    await act(async () => { release(); await publishing; });
    expect(getManifest).not.toHaveBeenCalled();
    expect(result.current.manifest.compare_with).toEqual(['2019']);
    expect(result.current.isDirty).toBe(true);
  });

  it('edits typed during the save step of a dirty publish survive the publish', async () => {
    const { result } = await loaded();
    act(() => result.current.updateManifest('compare_with', ['2019']));
    let release!: () => void;
    vi.mocked(saveManifestDraft).mockImplementationOnce(() => new Promise((r) => { release = () => r({} as never); }));
    let publishing!: Promise<boolean>;
    act(() => { publishing = result.current.publish(); });
    act(() => result.current.updateManifest('compare_with', ['2019', '2014']));
    vi.mocked(getManifest).mockClear();
    await act(async () => { release(); await publishing; });
    expect(publishManifest).toHaveBeenCalledTimes(1);
    expect(getManifest).not.toHaveBeenCalled();
    expect(result.current.manifest.compare_with).toEqual(['2019', '2014']);
    expect(result.current.isDirty).toBe(true);
  });
});

describe('useManifestEditor keeps keys it has no editor for', () => {
  it('a save after an edit still carries government (bellwether seats, seat analysis)', async () => {
    const government = { parties: ['BJP', 'JDU'], label: 'NDA', source: 'https://x' };
    vi.mocked(getManifest).mockResolvedValueOnce({ draft: { alliances: [], government }, manifest_url: null } as never);
    const { result } = await loaded();
    act(() => result.current.updateManifest('compare_with', ['2019']));
    await act(async () => { await result.current.saveDraft(result.current.manifest); });
    expect(vi.mocked(saveManifestDraft).mock.calls[0][1]).toMatchObject({ government, compare_with: ['2019'] });
  });
});
