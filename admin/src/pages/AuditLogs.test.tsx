// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AuditLog } from '../types';

const svc = vi.hoisted(() => ({ getAuditLogs: vi.fn() }));
vi.mock('../services/audit.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/audit.service')>()),
  getAuditLogs: svc.getAuditLogs,
}));
import AuditLogs, { RANGE_ERROR } from './AuditLogs';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';

const LOGS: AuditLog[] = [
  {
    id: 'l1', user_id: 'u1', users: { id: 'u1', email: 'priya@x.in', name: 'Priya S', role: 'EDITOR' },
    action: 'SEAT_LOCK_TAKEOVER', entity_type: 'constituency', entity_id: 'k145', old_value: { user_name: 'Rahul M' }, new_value: { user_name: 'Priya S' },
    timestamp: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'l2', user_id: null, users: null, action: 'RESULT_BULK_OVERRIDE', entity_type: 'election', entity_id: 'e1',
    old_value: null, new_value: { results_updated: 3, constituencies_with_rounds: 1 }, timestamp: '2026-10-01T07:00:00.000Z',
  },
  {
    id: 'l3', user_id: 'u2', users: { id: 'u2', email: 'mannu@x.in', name: 'Mannu K', role: 'SUPER_ADMIN' },
    action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1',
    old_value: { votes: 60000, status: 'TRAILING', margin: 0 }, new_value: { votes: 61204, status: 'LEADING', margin: 12214 },
    timestamp: '2026-10-01T06:00:00.000Z',
  },
];

beforeEach(() => { svc.getAuditLogs.mockImplementation(async () => LOGS); });
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/logs') => renderEntityPage('/logs', <AuditLogs />, at);
const table = () => screen.getByRole('table', { name: 'Audit log' });
const rowOf = (text: string) => within(table()).getByText(text).closest('tr')!;

describe('Audit logs page', () => {
  it('shows the admin from the users relation, readable action labels and IST times', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    expect(within(rowOf('Priya S')).getByText('Seat lock take-over')).toBeTruthy();
    expect(within(rowOf('Priya S')).getByText('01 Oct 2026, 13:30')).toBeTruthy();
    expect(within(rowOf('Deleted user')).getByText('Seat save (bulk)')).toBeTruthy();
    expect(within(rowOf('Mannu K')).getByText('Result override')).toBeTruthy();
    expect(within(rowOf('Mannu K')).getByText('Before → after')).toBeTruthy();
    expect(screen.getByText('3 entries')).toBeTruthy();
  });

  it('filter options are the real actions and entities plus "Any"', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    const options = (label: string) => within(screen.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent);
    expect(options('Action')).toEqual([
      'Any action', 'Result override', 'Seat save (bulk)', 'Seat lock take-over',
      'Party created', 'Party edited', 'Person edited', 'Persons merged', 'Merge undone', 'Person deleted (no contests left)',
      'Candidate created', 'Candidate edited', 'Candidate moved to person', 'Contest split to new person',
      'Candidate unlinked (legacy)', 'Seat edited',
      'User created', 'User edited', 'User role changed', 'Password reset', 'User deleted',
      'Election created', 'Election edited', 'Manifest draft saved', 'Manifest published',
      'Seat analysis computed', 'Analysis notes edited', 'Image uploaded', 'Feedback status changed',
    ]);
    expect(options('Entity')).toEqual([
      'Any entity', 'Result', 'Election', 'Seat', 'Party', 'Person', 'Candidate', 'User', 'Seat analysis', 'Image', 'Feedback',
    ]);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'SEAT_LOCK_TAKEOVER' } });
    await waitFor(() => expect(svc.getAuditLogs).toHaveBeenLastCalledWith({ action: 'SEAT_LOCK_TAKEOVER', entity_type: '', from: '', to: '' }));
  });

  it('a stale stored filter (old fake actions) is reset to Any (Review Focus 3)', async () => {
    localStorage.setItem('audit_logs_filters', JSON.stringify({ action: 'MANIFEST_DELETE', entity_type: 'manifest', from: 'yesterday', to: '' }));
    renderAt();
    await within(table()).findByText('Priya S');
    expect(svc.getAuditLogs).toHaveBeenCalledWith({ action: '', entity_type: '', from: '', to: '' });
    expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('');
  });

  it('From = To passes that day; From after To says so and sends no request (Review Focus 3)', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    fireEvent.change(screen.getByLabelText('From (IST)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To (IST)'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(svc.getAuditLogs).toHaveBeenLastCalledWith({ action: '', entity_type: '', from: '2026-10-01', to: '2026-10-01' }));
    const calls = svc.getAuditLogs.mock.calls.length;
    fireEvent.change(screen.getByLabelText('From (IST)'), { target: { value: '2026-10-05' } });
    expect(await screen.findByText(RANGE_ERROR)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.getAuditLogs.mock.calls.length).toBe(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(svc.getAuditLogs).toHaveBeenLastCalledWith({ action: '', entity_type: '', from: '', to: '' }));
  });

  it('Refresh keeps the rows on screen while it reloads', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    svc.getAuditLogs.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(within(table()).getByText('Priya S')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('a failed load shows the error with Try again', async () => {
    svc.getAuditLogs.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderAt();
    expect(await screen.findByText('Could not load audit logs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Priya S')).toBeTruthy();
  });

  it('Download CSV quotes every field and includes the change JSON', async () => {
    let blob: Blob | undefined;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((b: Blob) => { blob = b; return 'blob:audit'; }) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt();
    await within(table()).findByText('Priya S');
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    // jsdom's Blob has no text(); FileReader decodes UTF-8 (and drops the BOM).
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    expect(text.replace(/^\ufeff/, '').startsWith('"Time (IST)","Time (UTC)","Admin"')).toBe(true);
    expect(text).toContain('"Deleted user"');
    expect(text).toContain('"{""votes"":61204,""status"":""LEADING"",""margin"":12214}"');
  });

  it('names the CSV file with the IST day and explains the export on the button', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T20:00:00Z'));
    let name = '';
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:audit') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    renderAt();
    await within(table()).findByText('Priya S');
    const button = screen.getByRole('button', { name: 'Download CSV' });
    expect(button.getAttribute('title')).toBe('Exports the rows shown (up to 200)');
    fireEvent.click(button);
    expect(name).toBe('audit-logs-2026-10-02.csv');
  });

  it('a row opens the panel with the full before/after JSON', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Mannu K'));
    expect(screen.getByTestId('where').textContent).toBe('/logs/l3');
    const panel = await screen.findByRole('dialog', { name: 'Result override' });
    expect(within(within(panel).getByRole('region', { name: 'Before' })).getByText(/"votes": 60000/)).toBeTruthy();
    expect(within(within(panel).getByRole('region', { name: 'After' })).getByText(/"margin": 12214/)).toBeTruthy();
    expect(within(panel).getByText('mannu@x.in', { exact: false })).toBeTruthy();
  });

  it('a deep link to an unknown entry says not found', async () => {
    renderAt('/logs/nope');
    await within(table()).findByText('Priya S');
    expect(await within(screen.getByRole('dialog')).findByText('Audit entry not found')).toBeTruthy();
  });

  it('says "Showing latest 200" when the cap is reached', async () => {
    svc.getAuditLogs.mockImplementation(async () => Array.from({ length: 200 }, (_, i) => ({ ...LOGS[2], id: `x${i}` })));
    renderAt();
    expect(await screen.findByText('Showing latest 200')).toBeTruthy();
  });
});
