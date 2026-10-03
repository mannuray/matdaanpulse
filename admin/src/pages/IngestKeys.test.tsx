// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('../services/ingest.service', () => ({
  getIngestKeys: vi.fn(async () => [{ id: 'k1', name: 'worker-sg', created_at: '2027-02-20T05:00:00Z', last_used_at: null, revoked_at: null }]),
  createIngestKey: vi.fn(async () => ({ key: 'mpk_secret', row: { id: 'k2', name: 'laptop', created_at: '2027-02-21T05:00:00Z', last_used_at: null, revoked_at: null } })),
  revokeIngestKey: vi.fn(async () => ({})),
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
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect((screen.getByLabelText('New key value') as HTMLInputElement).value).toBe('mpk_secret'));
    expect(screen.getByText(/will not be shown again/)).toBeTruthy();
  });
  it('revokes a key after confirmation', async () => {
    mount();
    await screen.findByText('worker-sg');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(screen.getByText(/Jobs using it stop at their next request/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke key' }));
    await waitFor(() => expect(svc.revokeIngestKey).toHaveBeenCalledWith('k1'));
  });
});
