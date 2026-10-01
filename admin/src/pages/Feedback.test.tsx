// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Feedback as Item, FeedbackStatus } from '../types';

const db = vi.hoisted(() => ({ rows: [] as Item[] }));
const svc = vi.hoisted(() => ({
  getFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
}));
vi.mock('../services/feedback.service', () => svc);
import Feedback from './Feedback';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, kind: 'other', message: `Message ${id}`, email: null, page: null, status: 'new', createdAt: '2026-10-01T08:30:00.000Z', ...over,
});
const SEED = (): Item[] => [
  item('f1', { kind: 'bug', message: 'Round 2 total is wrong\nPlease check', email: 'a@b.in', page: '/elections/e1/seat/142' }),
  item('f2', { kind: 'data_error', message: 'Margin looks off' }),
  item('f3', { kind: 'suggestion', message: 'Add a seat search', status: 'read' }),
];

beforeEach(() => {
  db.rows = SEED();
  svc.getFeedback.mockImplementation(async (page: number, limit: number, status?: FeedbackStatus) => {
    const all = status ? db.rows.filter((f) => f.status === status) : db.rows;
    return { success: true, data: all.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / limit)) } };
  });
  svc.updateFeedbackStatus.mockImplementation(async (id: string, status: FeedbackStatus) => {
    db.rows = db.rows.map((f) => (f.id === id ? { ...f, status } : f));
    return db.rows.find((f) => f.id === id);
  });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

const renderAt = (at = '/feedback') => renderEntityPage('/feedback', <Feedback />, at);
const table = () => screen.getByRole('table', { name: 'Feedback' });
const rowOf = (text: string) => within(table()).getByText(text).closest('tr')!;
const chips = () => within(screen.getByRole('group', { name: 'Status' }));

describe('Feedback page', () => {
  it('lists reports with kind badges, a mailto email and the page path as plain text', async () => {
    renderAt();
    const row = (await within(table()).findByText(/Round 2 total is wrong/)).closest('tr')!;
    expect(within(row).getByText('Bug')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'a@b.in' }).getAttribute('href')).toBe('mailto:a@b.in');
    expect(within(row).getByText('/elections/e1/seat/142').closest('a')).toBeNull();
    expect(within(rowOf('Margin looks off')).getByText('Data error')).toBeTruthy();
    expect(within(rowOf('Add a seat search')).getByText('Read')).toBeTruthy();
    expect(screen.getByText('Showing 1–3 of 3 reports')).toBeTruthy();
    expect(svc.getFeedback).toHaveBeenCalledWith(1, 50, undefined);
  });

  it('status chips filter on the server; a stale stored filter starts on All', async () => {
    localStorage.setItem('feedback_filters', JSON.stringify({ status: 'archived' }));
    renderAt();
    await within(table()).findByText('Add a seat search');
    expect(chips().getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chips().getByRole('button', { name: 'New' }));
    await waitFor(() => expect(svc.getFeedback).toHaveBeenLastCalledWith(1, 50, 'new'));
    await waitFor(() => expect(within(table()).queryByText('Add a seat search')).toBeNull());
  });

  it('a row action is busy only on its row, then toasts and refreshes', async () => {
    let release!: (v: Item) => void;
    svc.updateFeedbackStatus.mockImplementationOnce((id: string, status: FeedbackStatus) => new Promise<Item>((r) => {
      release = (v) => r(v);
      db.rows = db.rows.map((f) => (f.id === id ? { ...f, status } : f));
    }));
    renderAt();
    await within(table()).findByText('Margin looks off');
    const before = svc.getFeedback.mock.calls.length;
    fireEvent.click(within(rowOf('Margin looks off')).getByRole('button', { name: 'Resolve' }));
    expect((within(rowOf('Margin looks off')).getByRole('button', { name: 'Mark read' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(rowOf('Add a seat search')).getByRole('button', { name: 'Resolve' }) as HTMLButtonElement).disabled).toBe(false);
    release(item('f2', { kind: 'data_error', message: 'Margin looks off', status: 'resolved' }));
    expect(await screen.findByText('Marked resolved')).toBeTruthy();
    await waitFor(() => expect(svc.getFeedback.mock.calls.length).toBeGreaterThan(before));
    expect(svc.updateFeedbackStatus).toHaveBeenCalledWith('f2', 'resolved');
  });

  it('a row opens the panel; resolving it under the New filter keeps the panel on the record', async () => {
    localStorage.setItem('feedback_filters', JSON.stringify({ status: 'new' }));
    renderAt();
    fireEvent.click(await within(table()).findByText(/Round 2 total is wrong/));
    expect(screen.getByTestId('where').textContent).toBe('/feedback/f1');
    const panel = await screen.findByRole('dialog', { name: 'Feedback' });
    expect(within(panel).getByText('Round 2 total is wrong Please check')).toBeTruthy();
    expect(within(panel).getByText('/elections/e1/seat/142').closest('a')).toBeNull();
    expect(within(panel).getByRole('link', { name: 'a@b.in' })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(within(table()).queryByText(/Round 2 total is wrong/)).toBeNull());
    expect(within(panel).getByText('Resolved')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Mark read' })).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Resolve' })).toBeNull();
  });

  it('clamps back a page when an action empties the last page', async () => {
    db.rows = Array.from({ length: 51 }, (_, i) => item(`n${i + 1}`, { message: `Report ${i + 1}` }));
    localStorage.setItem('feedback_filters', JSON.stringify({ status: 'new' }));
    renderAt();
    await within(table()).findByText('Report 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(within((await within(table()).findByText('Report 51')).closest('tr')!).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(screen.getByText('Page 1 of 1')).toBeTruthy());
    expect(await within(table()).findByText('Report 1')).toBeTruthy();
  });

  it('a deep link to an unknown id says not found', async () => {
    renderAt('/feedback/zzz');
    await within(table()).findByText('Margin looks off');
    expect(await within(screen.getByRole('dialog')).findByText('Feedback not found')).toBeTruthy();
  });

  it('a failed list shows Could not load feedback with Try again, in the table and the panel', async () => {
    svc.getFeedback.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderAt('/feedback/f1');
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findByText('Could not load feedback')).toBeTruthy();
    expect(within(table().parentElement!.parentElement!).getByText('Could not load feedback')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Try again' }));
    expect(await within(panel).findByText('Round 2 total is wrong Please check')).toBeTruthy();
  });
});
