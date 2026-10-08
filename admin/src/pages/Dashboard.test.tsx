// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Election } from '../types';

const svc = vi.hoisted(() => ({
  getLiveResults: vi.fn(),
  getSeatLocks: vi.fn(),
  getAuditLogs: vi.fn(),
  getSystemStatus: vi.fn(),
  getReadiness: vi.fn(),
  getFeedback: vi.fn(),
  getUsers: vi.fn(),
}));
vi.mock('../services/live.service', () => ({ getLiveResults: svc.getLiveResults, getSeatLocks: svc.getSeatLocks }));
vi.mock('../services/audit.service', () => ({ getAuditLogs: svc.getAuditLogs }));
vi.mock('../services/status.service', () => ({ getSystemStatus: svc.getSystemStatus }));
vi.mock('../services/health.service', () => ({ getReadiness: svc.getReadiness }));
vi.mock('../services/feedback.service', () => ({ getFeedback: svc.getFeedback }));
vi.mock('../services/user.service', () => ({ getUsers: svc.getUsers }));

const ELECTIONS: Election[] = [
  { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 1, year: 2025, status: 'Live', tentative_next_date: null, delimitation: null, manifest_url: null },
  { id: 'e2', name: 'Kerala Vidhan Sabha 2026', type: 'VS', state_id: 2, year: 2026, status: 'Upcoming', tentative_next_date: '2026-04-20T00:00:00.000Z', delimitation: null, manifest_url: null },
  { id: 'e3', name: 'Lok Sabha 2024', type: 'LS', state_id: null, year: 2024, status: 'Finalized', tentative_next_date: null, delimitation: null, manifest_url: null },
];
const ctx = vi.hoisted(() => ({ electionId: 'e1', loading: false, error: null as string | null, reload: vi.fn(async () => {}), list: [] as unknown[] }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({
    elections: ctx.list, electionId: ctx.electionId,
    election: (ctx.list as Election[]).find((e) => e.id === ctx.electionId) ?? null,
    setElectionId: vi.fn(), loading: ctx.loading, error: ctx.error, reload: ctx.reload,
  }),
}));
const auth = vi.hoisted(() => ({ roles: ['SUPER_ADMIN'] as string[] }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Mannu K', role: auth.roles[0], email: 'm@x.in' }, hasRole: (...r: string[]) => r.some((x) => auth.roles.includes(x)) }),
}));
import Dashboard from './Dashboard';
import { ApiError } from '../services/api-client';

// Mid-minute offsets (2.5 min, 4.5 min): the fixtures are built a few ms after the page reads `now`.
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const cand = (id: string, party: string, votes: number, status: string, last = ago(3_600_000)) => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: `Cand ${id}`, party_id: party, party_name: party, party_color: null,
  party_abbr: party, votes, status, margin: 0, last_updated: last,
});
const seats = () => [
  { const_id: 'k1', const_name: 'Valmiki Nagar', const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [cand('a1', 'BJP', 0, 'TRAILING')] },
  { const_id: 'k2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [cand('b1', 'BJP', 900, 'LEADING', ago(150_000)), cand('b2', 'INC', 700, 'TRAILING')] },
  { const_id: 'k3', const_name: 'Bikram', const_no: 145, const_type: 'GEN', current_round: 6, total_rounds: 20, candidates: [cand('c1', 'BJP', 500, 'LEADING'), cand('c2', 'RJD', 400, 'TRAILING')] },
  { const_id: 'k4', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [cand('d1', 'RJD', 800, 'WON'), cand('d2', 'BJP', 600, 'LOST')] },
];
const STATUS = {
  db: { ok: true, latencyMs: 12, pool: { connectionLimit: 5, poolTimeoutSeconds: null } },
  redis: { pubReady: true, subReady: true, publishes: 0, published: 0, publishErrors: 0 },
  live: { sseConnections: 3, eventsPublished: 0, overridesApplied: 0, overridesLast5m: 0, overridesPerMin: 18, lastOverrideAt: null },
};
const FEEDBACK = () => ({
  success: true,
  data: [
    { id: 'f1', kind: 'bug', message: 'Round 2 total is wrong\nPlease check', email: 'a@b.in', page: '/elections/e1/seat/142', status: 'new', createdAt: ago(600_000) },
    { id: 'f2', kind: 'data_error', message: 'Margin looks off', email: null, page: null, status: 'new', createdAt: ago(1_680_000) },
  ],
  pagination: { page: 1, limit: 3, total: 5, totalPages: 2 },
});

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  auth.roles = ['SUPER_ADMIN'];
  ctx.electionId = 'e1'; ctx.loading = false; ctx.error = null; ctx.list = ELECTIONS;
  svc.getLiveResults.mockImplementation(async () => seats());
  svc.getSeatLocks.mockImplementation(async () => [{ const_id: 'k3', user_id: 'u1', user_name: 'Priya S', acquired_at: new Date().toISOString() }]);
  svc.getAuditLogs.mockImplementation(async () => [{
    id: 'l1', user_id: 'u1', users: { id: 'u1', email: 'p@x.in', name: 'Priya S', role: 'EDITOR' },
    action: 'SEAT_LOCK_TAKEOVER', entity_type: 'constituency', entity_id: 'k3', old_value: { user_name: 'Rahul M' }, new_value: null, timestamp: ago(270_000),
  }]);
  svc.getSystemStatus.mockImplementation(async () => STATUS);
  svc.getReadiness.mockImplementation(async () => ({ status: 'healthy', checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'healthy', latencyMs: 2 } } }));
  svc.getFeedback.mockImplementation(async () => FEEDBACK());
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

const renderDashboard = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>);
const region = (name: string) => screen.getByRole('region', { name });
const ADMIN_CALLS = ['getLiveResults', 'getSeatLocks', 'getAuditLogs', 'getSystemStatus', 'getReadiness', 'getFeedback', 'getUsers'] as const;

describe('Dashboard — SUPER_ADMIN', () => {
  it('shows the KPIs, live console, readable activity, system health and new feedback', async () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Bihar VS 2025 · counting in progress')).toBeTruthy();
    expect(await screen.findByText('BJP ahead in 2 seats')).toBeTruthy();
    expect(region('Seats declared').textContent).toContain('1 / 4');
    expect(within(region('Leading')).getByText('2')).toBeTruthy();
    expect(within(region('Pending')).getByText('no votes yet')).toBeTruthy();
    expect(within(region('Last update')).getByText('2 min ago · Round 24')).toBeTruthy();

    const live = region('Live console');
    expect(within(live).getByText('Counting progress · 75% of seats reporting')).toBeTruthy();
    expect(await within(live).findByText('Seats being edited now: 1')).toBeTruthy();
    expect(within(live).getByText('Priya S · 145 Bikram')).toBeTruthy();
    expect(within(live).getByRole('link', { name: /Open live console/ }).getAttribute('href')).toBe('/overrides');

    const activity = region('Recent activity');
    expect(await within(activity).findByText('Priya S took over 145 Bikram from Rahul M')).toBeTruthy();
    expect(within(activity).getByText('4 min ago')).toBeTruthy();
    expect(within(activity).getByRole('link', { name: /View audit log/ }).getAttribute('href')).toBe('/logs');

    const health = region('System health');
    expect(await within(health).findByText('All OK')).toBeTruthy();
    expect(within(health).getByText('OK · 12 ms')).toBeTruthy();
    expect(within(health).getByText('3 connections')).toBeTruthy();
    expect(within(health).getByRole('link', { name: /Open system status/ }).getAttribute('href')).toBe('/status');

    const feedback = region('Feedback');
    expect(await within(feedback).findByText('5 new')).toBeTruthy();
    expect(within(feedback).getByText('Bug')).toBeTruthy();
    expect(within(feedback).getByText('Data error')).toBeTruthy();
    expect(within(feedback).getByText('Round 2 total is wrong')).toBeTruthy();
    expect(within(feedback).getByText('/elections/e1/seat/142').tagName).toBe('P');
    expect(within(feedback).queryByRole('link', { name: /elections\/e1/ })).toBeNull();
    expect(within(feedback).getByRole('link', { name: /View all feedback/ }).getAttribute('href')).toBe('/feedback');
    expect(svc.getFeedback).toHaveBeenCalledWith(1, 3, 'new');
    expect(svc.getUsers).not.toHaveBeenCalled();
  });
});

describe('Dashboard — role gating (Review Focus 1)', () => {
  it('an EDITOR never requests audit logs or /admin/status and has no Recent activity card', async () => {
    auth.roles = ['EDITOR'];
    renderDashboard();
    expect(await within(region('System health')).findByText('All OK')).toBeTruthy();
    expect(await within(region('Feedback')).findByText('5 new')).toBeTruthy();
    expect(svc.getAuditLogs).not.toHaveBeenCalled();
    expect(svc.getSystemStatus).not.toHaveBeenCalled();
    expect(svc.getReadiness).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Recent activity' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Open system status/ })).toBeNull();
    expect(within(region('System health')).getByText('OK · 4 ms')).toBeTruthy();
  });

  it('a VIEWER sees only the elections overview and no admin endpoint is called', async () => {
    auth.roles = ['VIEWER'];
    renderDashboard();
    expect(screen.getByText('Elections at a glance')).toBeTruthy();
    expect(within(region('Live')).getByText('1')).toBeTruthy();
    expect(within(region('Upcoming')).getByText('1')).toBeTruthy();
    expect(within(region('Finalized')).getByText('1')).toBeTruthy();
    expect(within(region('Live now')).getByText('Bihar Vidhan Sabha 2025')).toBeTruthy();
    expect(within(region('Upcoming elections')).getByText('Kerala Vidhan Sabha 2026')).toBeTruthy();
    expect(within(region('Upcoming elections')).getByText('20 Apr 2026')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    for (const fn of ADMIN_CALLS) expect(svc[fn]).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Seats declared' })).toBeNull();
    expect(screen.queryByText(/^0$/)).toBeNull();
  });
});

describe('Dashboard — card states', () => {
  it('a degraded readiness check says so (EDITOR)', async () => {
    auth.roles = ['EDITOR'];
    svc.getReadiness.mockResolvedValueOnce({ status: 'degraded', checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'unhealthy', latencyMs: 2000 } } });
    renderDashboard();
    const health = region('System health');
    expect(await within(health).findByText('Degraded')).toBeTruthy();
    expect(within(health).getByText('Down')).toBeTruthy();
  });

  it('one failing card shows its own error with Try again; the others still load', async () => {
    svc.getFeedback.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderDashboard();
    const feedback = region('Feedback');
    expect((await within(feedback).findByRole('alert')).textContent).toContain('Could not load feedback');
    expect(await within(region('System health')).findByText('All OK')).toBeTruthy();
    fireEvent.click(within(feedback).getByRole('button', { name: 'Try again' }));
    expect(await within(feedback).findByText('5 new')).toBeTruthy();
    expect(svc.getFeedback).toHaveBeenCalledTimes(2);
  });

  it('a VIEWER whose elections refresh failed keeps the earlier list and says so', () => {
    auth.roles = ['VIEWER'];
    ctx.error = 'Could not load elections';
    renderDashboard();
    expect(within(region('Live now')).getByText('Bihar Vidhan Sabha 2025')).toBeTruthy();
    expect(screen.getByText('Last refresh failed — showing earlier data.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('seat locking down (503) reads "Seat locking unavailable"', async () => {
    svc.getSeatLocks.mockRejectedValueOnce(new ApiError('Seat locking is unavailable', 503));
    renderDashboard();
    expect(await within(region('Live console')).findByText('Seat locking unavailable')).toBeTruthy();
  });

  it('with no election, shows the one empty state and loads no live data', async () => {
    ctx.electionId = '';
    ctx.list = [];
    renderDashboard();
    expect(screen.getByText('No election yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create an election' }).getAttribute('href')).toBe('/elections/new');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(svc.getLiveResults).not.toHaveBeenCalled();
  });

  it('refreshes every 30 s while the tab is visible and pauses while hidden', async () => {
    vi.useFakeTimers();
    try {
      renderDashboard();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(2);
      expect(svc.getLiveResults).toHaveBeenCalledTimes(2);
      expect(ctx.reload).toHaveBeenCalledTimes(1);
      act(() => setHidden(true));
      await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(2);
      await act(async () => { setHidden(false); await vi.advanceTimersByTimeAsync(0); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(3);
    } finally {
      setHidden(false);
    }
  });
});
