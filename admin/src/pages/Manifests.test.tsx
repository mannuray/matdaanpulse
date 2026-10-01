// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

const data = vi.hoisted(() => ({
  elections: [
    { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null },
    { id: 'e2', name: 'Lok Sabha 2024', type: 'LS', year: 2024, status: 'Finalized', state_id: null, tentative_next_date: null, manifest_url: 'https://cdn.example/ls2024.json' },
  ],
}));
const svc = vi.hoisted(() => ({
  getElections: vi.fn(async () => data.elections),
  getManifest: vi.fn(async () => ({
    election_id: 'e1', manifest_url: null,
    draft: { alliances: [{ id: 'nda', name: 'NDA', color: '#f97316', parties: ['BJP'] }], milestones: [{ label: 'Majority', value: 122 }] },
  })),
  saveManifestDraft: vi.fn(async (_e: string, _m: object) => ({})),
  publishManifest: vi.fn(async () => ({})),
}));
vi.mock('../services/election.service', () => svc);
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => [{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f97316' }]) }));
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async () => []) }));
vi.mock('../services/candidate.service', () => ({ searchCandidates: vi.fn(async () => []) }));
const ctx = vi.hoisted(() => ({ reload: vi.fn(async () => {}) }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({ elections: data.elections, electionId: 'e1', election: data.elections[0], setElectionId: vi.fn(), loading: false, error: null, reload: ctx.reload }),
}));
const auth = vi.hoisted(() => ({ role: 'EDITOR' }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: auth.role, email: 'x' }, hasRole: (...r: string[]) => r.includes(auth.role) }),
}));
import { ApiError } from '../services/api-client';
import Manifests from './Manifests';
import { renderEntityPage } from '../test-utils/entity-harness';

beforeEach(() => { auth.role = 'EDITOR'; });
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/manifests') => renderEntityPage('/manifests', <Manifests />, at);
const table = () => screen.getByRole('table', { name: 'Manifests' });

describe('Manifests page', () => {
  it('lists one manifest per election with its published state and opens the full-width panel on Summary', async () => {
    renderAt();
    const e1 = within(table()).getByText('Bihar Vidhan Sabha 2025').closest('tr')!;
    expect(within(e1).getByText('Not published')).toBeTruthy();
    expect(within(within(table()).getByText('Lok Sabha 2024').closest('tr')!).getByText('Published')).toBeTruthy();
    fireEvent.click(within(table()).getByText('Bihar Vidhan Sabha 2025'));
    expect(screen.getByTestId('where').textContent).toBe('/manifests/e1');
    const panel = screen.getByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect(panel.className).toContain('inset-0');
    expect(await within(panel).findByText('NDA')).toBeTruthy();
    expect(within(panel).getByText('Draft')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Summary' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Edit shows the existing editors with their legacy styles; an EDITOR has no Publish button', async () => {
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    expect(within(panel).queryByRole('button', { name: 'Publish' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    const milestones = within(panel).getByText('Milestones');
    expect(milestones.closest('.mf-section')).not.toBeNull();
    expect(milestones.closest('.tw-ui')).toBeNull();
  });

  it('a SUPER_ADMIN publishes after confirming, and the election list is reloaded', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'Publish' }));
    expect(svc.publishManifest).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(svc.publishManifest).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(ctx.reload).toHaveBeenCalled());
  });

  it('JSON: invalid text blocks tab switches and Save draft; a valid edit is guarded and saves as the draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'JSON' }));
    const json = within(panel).getByLabelText('Manifest JSON');
    fireEvent.change(json, { target: { value: '{bad' } });
    expect(within(panel).getByRole('alert')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Summary' }));
    expect(within(panel).getByLabelText('Manifest JSON')).toBeTruthy();
    const next = { alliances: [], milestones: [{ label: 'Majority', value: 122 }] };
    fireEvent.change(json, { target: { value: JSON.stringify(next) } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/manifests/e1');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(svc.saveManifestDraft).toHaveBeenCalledWith('e1', next));
  });

  it('Edit renders every editor section expanded', async () => {
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    const sections = panel.querySelectorAll('.mf-section');
    expect(sections.length).toBeGreaterThanOrEqual(8);
    sections.forEach((sec) => expect(sec.querySelector('.mf-section-body')).not.toBeNull());
  });

  it('a failed load offers Try again; a 404 says the election is not found', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.getManifest.mockRejectedValueOnce(new ApiError('boom', 500));
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Try again' }));
    expect(await within(panel).findByText('NDA')).toBeTruthy();
    cleanup();
    svc.getManifest.mockRejectedValueOnce(new ApiError('nope', 404));
    renderAt('/manifests/e1');
    const p2 = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect(await within(p2).findByText('Election not found')).toBeTruthy();
    expect(within(p2).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('JSON must be an object: a number or array shows an error and blocks Save draft', async () => {
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'JSON' }));
    for (const bad of ['5', '[]', 'null']) {
      fireEvent.change(within(panel).getByLabelText('Manifest JSON'), { target: { value: bad } });
      expect(within(panel).getByRole('alert').textContent).toContain('object');
      expect((within(panel).getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('Publish with a pending valid JSON edit saves that JSON first; a failed save aborts the publish', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'JSON' }));
    const next = { alliances: [], milestones: [{ label: 'Majority', value: 100 }] };
    fireEvent.change(within(panel).getByLabelText('Manifest JSON'), { target: { value: JSON.stringify(next) } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Publish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(svc.publishManifest).toHaveBeenCalledWith('e1'));
    expect(svc.saveManifestDraft).toHaveBeenCalledWith('e1', next);
    expect(svc.saveManifestDraft.mock.invocationCallOrder[0]).toBeLessThan(svc.publishManifest.mock.invocationCallOrder[0]);
  });

  it('a failed draft save aborts the publish', async () => {
    auth.role = 'SUPER_ADMIN';
    svc.saveManifestDraft.mockRejectedValueOnce(new Error('save failed'));
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'JSON' }));
    fireEvent.change(within(panel).getByLabelText('Manifest JSON'), { target: { value: '{"alliances":[]}' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Publish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(svc.saveManifestDraft).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publish now' })).toBeNull());
    expect(svc.publishManifest).not.toHaveBeenCalled();
  });
});
