// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShellStatusProvider } from '../../context/ShellStatusContext';
import { FeedPanel } from './FeedPanel';

afterEach(cleanup);
const status = { election_id: 'e', status: 'Live', active_source: 'eci-web', hold_minutes: 10, alerts: [{ key: 'k', level: 'error' as const, shard: 'rest', message: 'No job holds shard rest' }],
  shards: [{ name: 'rest', seat_count: 126, source: 'eci-web', lease_holder: 'worker-sg', lease_expires_at: new Date(Date.now() + 60_000).toISOString(), last_post_at: new Date().toISOString(),
    last_applied_at: null, lag_s: 42, recent: { applied: 5, unchanged: 100, stale: 0, held: 1, rejected: 2 }, rejected: [{ const_id: 'S1', reason: 'roster_mismatch' }], tally_mismatch: null }] };
const renderPanel = (onApply = vi.fn(async () => true)) =>
  render(<ShellStatusProvider><FeedPanel status={status} sources={['eci-web', 'news']} saving={false} onApply={onApply} /></ShellStatusProvider>);

describe('FeedPanel', () => {
  it('shows alerts, shard status and rejected reasons', () => {
    renderPanel();
    expect(screen.getByRole('alert').textContent).toMatch(/No job holds shard rest/);
    expect(screen.getByText('worker-sg')).toBeTruthy();
    expect(screen.getByText('42 s')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /1 rejected/ }));
    expect(screen.getByText(/S1/).textContent).toMatch(/roster_mismatch/);
  });
  it('pausing applies without a confirmation; switching source asks first', () => {
    const onApply = vi.fn(async () => true);
    renderPanel(onApply);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(null, 10);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'news' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('dialog').textContent).toMatch(/Switch the live source to news/);
  });
  it('flags a shard whose tally differs', () => {
    const st = { ...status, shards: [{ ...status.shards[0], tally_mismatch: [{ party_id: 'BJP' }, { party_id: 'INC' }] }] };
    render(<ShellStatusProvider><FeedPanel status={st} sources={[]} saving={false} onApply={vi.fn()} /></ShellStatusProvider>);
    expect(screen.getByText(/Tally differs: BJP, INC/)).toBeTruthy();
  });
  it('Other… reveals a text input for a new source', () => {
    const onApply = vi.fn(async () => true);
    renderPanel(onApply);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '__other__' } });
    fireEvent.change(screen.getByLabelText('Other source'), { target: { value: 'ecinet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('dialog').textContent).toMatch(/Switch the live source to ecinet/);
  });
});
