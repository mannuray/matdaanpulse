// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('../services/ingest.service', () => ({
  getIngestKeys: vi.fn(async () => [
    { id: 'k1', name: 'worker-sg', election_id: 'e1', expires_at: '2099-03-01T05:00:00Z', created_at: '2027-02-20T05:00:00Z', last_used_at: null, revoked_at: null },
    { id: 'k0', name: 'old-key', election_id: 'e2', expires_at: '2020-01-01T00:00:00Z', created_at: '2019-12-20T05:00:00Z', last_used_at: null, revoked_at: null },
    { id: 'k9', name: 'legacy', election_id: null, expires_at: null, created_at: '2026-10-01T05:00:00Z', last_used_at: null, revoked_at: null },
  ]),
  createIngestKey: vi.fn(async () => ({ key: 'mpk_secret', row: { id: 'k2', name: 'laptop', election_id: 'e2', expires_at: '2099-03-01T05:00:00Z', created_at: '2027-02-21T05:00:00Z', last_used_at: null, revoked_at: null } })),
  revokeIngestKey: vi.fn(async () => ({})),
}));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({
    elections: [{ id: 'e1', name: 'Assam 2026', status: 'Live' }, { id: 'e2', name: 'Kerala 2026', status: 'Upcoming' }],
    electionId: 'e1', election: { id: 'e1', name: 'Assam 2026' }, setElectionId: vi.fn(), loading: false, error: null, reload: vi.fn(),
  }),
}));
import * as svc from '../services/ingest.service';
import { ToastProvider } from '../context/ToastContext';
import IngestKeys from './IngestKeys';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mount = () => render(<ToastProvider><IngestKeys /></ToastProvider>);

describe('IngestKeys', () => {
  it('lists keys, creates one and shows it once', async () => {
    mount();
    expect(await screen.findByText('worker-sg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New key' }));
    fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'laptop' } });
    expect((screen.getByLabelText('Election') as HTMLSelectElement).value).toBe('e1'); // the selected election by default
    fireEvent.change(screen.getByLabelText('Election'), { target: { value: 'e2' } });
    expect((screen.getByLabelText('Expires after') as HTMLSelectElement).value).toBe('7');
    fireEvent.change(screen.getByLabelText('Expires after'), { target: { value: '14' } });
    const t0 = Date.now();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect((screen.getByLabelText('New key value') as HTMLInputElement).value).toBe('mpk_secret'));
    const [name, electionId, expiresAt] = vi.mocked(svc.createIngestKey).mock.calls[0];
    expect([name, electionId]).toEqual(['laptop', 'e2']);
    expect(Math.abs(new Date(expiresAt).getTime() - (t0 + 14 * 86_400_000))).toBeLessThan(60_000);
    expect(screen.getByText(/will not be shown again/)).toBeTruthy();
  });
  it('shows each key\'s election and expiry; an expired key is marked and a legacy key is valid for any election', async () => {
    mount();
    await screen.findByText('worker-sg');
    expect(screen.getByText('Assam 2026')).toBeTruthy();
    expect(screen.getByText('Kerala 2026')).toBeTruthy();
    expect(screen.getByText('Any (legacy)')).toBeTruthy();
    expect(screen.getByText('expired')).toBeTruthy();
    expect(screen.getByText('no expiry')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2); // the expired key needs no revoke
  });
  it('revokes a key after confirmation', async () => {
    mount();
    await screen.findByText('worker-sg');
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[0]);
    expect(screen.getByText(/Jobs using it stop at their next request/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke key' }));
    await waitFor(() => expect(svc.revokeIngestKey).toHaveBeenCalledWith('k1'));
  });
});
