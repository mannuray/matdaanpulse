import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { join } from 'node:path';
import { adminToken, API, ARTIFACTS, MOCK, SIM } from './env';
import type { Alliance, ResultRow } from '../../src/model/types';

export type SeatState = { state: string; cr: number | null; tr: number | null };
export type Snapshot = { version: number; results: ResultRow[]; summary: (Alliance & { won?: number; leading?: number })[]; seats?: Record<string, SeatState>; trail?: Record<string, { lc?: number }> };
export type LiveDoc = { version: number; status: string; declared: number; total: number };
export type AdminSeat = { const_id: string; seat_state?: string | null; candidates: { candidate_id: string; party_id: string; candidate_name?: string; votes: number; status: string }[] };

let token: string | null = null;
async function auth(): Promise<Record<string, string>> { token ??= await adminToken(); return { Authorization: `Bearer ${token}` }; }

export async function liveState(request: APIRequestContext): Promise<LiveDoc> {
  const res = await request.get(`${API}/elections/${SIM}/live`);
  expect(res.ok(), `GET /live HTTP ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: LiveDoc }).data;
}

export async function snapshot(request: APIRequestContext, version: number): Promise<Snapshot> {
  const res = await request.get(`${API}/elections/${SIM}/results?v=${version}`);
  expect(res.ok(), `GET results?v=${version} HTTP ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: Snapshot }).data;
}

export async function mockRound(): Promise<number> {
  return ((await (await fetch(`${MOCK}/status`)).json()) as { currentRound: number }).currentRound;
}
export async function advance(): Promise<number> {
  return ((await (await fetch(`${MOCK}/advance-round`, { method: 'POST' })).json()) as { round: number }).round;
}
export async function mockReset(): Promise<void> { await fetch(`${MOCK}/reset`, { method: 'POST' }); }

/** const_no → the seat's round, for seats that have started. */
async function mockSeats(): Promise<Record<string, { currentRound: number; totalRounds: number }>> {
  return (await (await fetch(`${MOCK}/status/constituencies`)).json()) as Record<string, { currentRound: number; totalRounds: number }>;
}

/** Sim const ids are BR_VS27_<const_no>_<NAME> (scraper/src/simulation/setup.ts). */
export function constNoOf(constId: string): number { return Number(/_VS\d*_(\d+)/.exec(constId)![1]); }

/**
 * Waits until every started, non-excluded seat in the latest snapshot is at the mock's round (declared once the
 * mock's seat is at its last round) and the version held still for one poll. Fails with the lagging seats.
 */
export async function settle(request: APIRequestContext, excluded: Set<string>, label: string): Promise<Snapshot> {
  const deadline = Date.now() + 60_000;
  let lastVersion = -1;
  let lagging: string[] = ['(no snapshot yet)'];
  while (Date.now() < deadline) {
    const want = await mockSeats();
    const live = await liveState(request);
    if (live.version === lastVersion) {
      const snap = await snapshot(request, live.version);
      const byNo = new Map(Object.entries(snap.seats ?? {}).map(([id, s]) => [constNoOf(id), { id, s }]));
      lagging = [];
      for (const [no, w] of Object.entries(want)) {
        const got = byNo.get(Number(no));
        if (got && excluded.has(got.id)) continue;
        const ok = !!got && (w.currentRound >= w.totalRounds ? got.s.state === 'declared' : got.s.cr === w.currentRound);
        if (!ok) lagging.push(`${no} (mock ${w.currentRound}/${w.totalRounds}, api ${got ? `${got.s.state} ${got.s.cr}` : 'none'})`);
      }
      if (lagging.length === 0) return snap;
    }
    lastVersion = live.version;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${label}: backend not settled after 60 s; lagging seats: ${lagging.slice(0, 15).join(', ')}${lagging.length > 15 ? ` (+${lagging.length - 15} more)` : ''}; worker log ${join(ARTIFACTS, 'worker.log')}`);
}

/** Advances the mock to `round`, settling after every step; returns the settled snapshot. */
export async function advanceTo(request: APIRequestContext, round: number, excluded: Set<string>): Promise<Snapshot> {
  let r = await mockRound();
  let snap: Snapshot | null = null;
  while (r < round) { r = await advance(); snap = await settle(request, excluded, `round ${r}`); }
  return snap ?? snapshot(request, (await liveState(request)).version);
}

/** The page has rendered snapshot `version` (the data-live-version hook). Viewers poll every 10 s + jitter. */
export async function waitForViewer(page: Page, version: number, label = ''): Promise<void> {
  await expect(page.locator(`[data-live-version="${version}"]`), `${label} viewer did not render version ${version}`).toHaveCount(1, { timeout: 45_000 });
}

export async function setStatus(request: APIRequestContext, status: 'Upcoming' | 'Live' | 'Finalized'): Promise<void> {
  const res = await request.patch(`${API}/admin/elections/${SIM}`, { headers: await auth(), data: { status } });
  expect(res.ok(), `set ${status}: HTTP ${res.status()} ${await res.text()}`).toBe(true);
}

/** Admin seat correction (places a hold); `votes` must list every candidate of the seat. */
export async function correct(request: APIRequestContext, constId: string, state: string, votes: Record<string, number>, round: { current: number; total: number } | null = null): Promise<void> {
  const res = await request.put(`${API}/admin/elections/${SIM}/seats/${constId}`, { headers: await auth(), data: { state, votes, ...(round ? { round } : {}) } });
  expect(res.ok(), `correct ${constId} ${state}: HTTP ${res.status()} ${await res.text()}`).toBe(true);
}

export async function releaseHold(request: APIRequestContext, constId: string): Promise<void> {
  await request.delete(`${API}/admin/elections/${SIM}/holds/${constId}`, { headers: await auth() });
}

/** Seats currently on hold. */
export async function holds(request: APIRequestContext): Promise<string[]> {
  const res = await request.get(`${API}/admin/elections/${SIM}/holds`, { headers: await auth() });
  expect(res.ok(), `GET holds HTTP ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { const_id: string }[] };
  return body.data.map(h => h.const_id);
}

/** Admin per-seat roster (candidate ids and votes) for corrections. */
export async function adminSeats(request: APIRequestContext): Promise<AdminSeat[]> {
  const res = await request.get(`${API}/admin/elections/${SIM}/live-results`, { headers: await auth() });
  expect(res.ok(), `GET live-results HTTP ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: AdminSeat[] }).data;
}

export async function shot(page: Page, checkpoint: string, viewport: string): Promise<void> {
  await page.screenshot({ path: join(ARTIFACTS, `${checkpoint}-${viewport}.png`) });
}
