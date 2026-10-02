import { describe, it, expect } from 'vitest';
import {
  ELECTION_PHASE, editingNow, groupElections, healthFromReadiness, healthFromStatus, lastUpdateSubtitle, leadingSubtitle, seatLookup, summarizeLive,
} from './dashboard';
import type { Election, LiveConstituency } from '../types';
import type { SystemStatus } from '../services/status.service';

const cand = (id: string, party: string, votes: number, status: string, last = '2026-10-01T09:00:00.000Z') => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: `Cand ${id}`, party_id: party, party_name: party, party_color: null,
  party_abbr: party, votes, status, margin: 0, last_updated: last,
});
const SEATS: LiveConstituency[] = [
  { const_id: 'k1', const_name: 'Valmiki Nagar', const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [cand('a1', 'BJP', 0, 'TRAILING'), cand('a2', 'INC', 0, 'TRAILING')] },
  { const_id: 'k2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [cand('b1', 'BJP', 900, 'LEADING', '2026-10-01T09:58:00.000Z'), cand('b2', 'INC', 700, 'TRAILING')] },
  { const_id: 'k3', const_name: 'Bikram', const_no: 145, const_type: 'GEN', current_round: 6, total_rounds: 20, candidates: [cand('c1', 'BJP', 500, 'LEADING'), cand('c2', 'RJD', 400, 'TRAILING')] },
  { const_id: 'k4', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [cand('d1', 'RJD', 800, 'WON'), cand('d2', 'BJP', 600, 'LOST')] },
];
const NOW = Date.parse('2026-10-01T10:00:00.000Z');

describe('summarizeLive', () => {
  it('counts seats, finds the party ahead, the newest update and the highest round', () => {
    const s = summarizeLive(SEATS);
    expect(s).toEqual({
      total: 4, declared: 1, leading: 2, pending: 1, reportingPct: 75,
      topLeader: { party: 'BJP', seats: 2 }, lastUpdate: '2026-10-01T09:58:00.000Z', round: 24,
    });
    expect(leadingSubtitle(s)).toBe('BJP ahead in 2 seats');
    expect(lastUpdateSubtitle(s, NOW)).toBe('2 min ago · Round 24');
  });

  it('an election with no votes yet', () => {
    const s = summarizeLive([SEATS[0]]);
    expect(s).toMatchObject({ total: 1, pending: 1, leading: 0, topLeader: null, lastUpdate: null, round: null, reportingPct: 0 });
    expect(leadingSubtitle(s)).toBe('no seat has a leader yet');
    expect(lastUpdateSubtitle(s, NOW)).toBe('no votes yet');
    expect(leadingSubtitle({ ...s, topLeader: { party: 'JDU', seats: 1 } })).toBe('JDU ahead in 1 seat');
  });
});

describe('editingNow and seatLookup', () => {
  it('names the seat for each live lock and drops lapsed ones', () => {
    const locks = [
      { const_id: 'k3', user_id: 'u1', user_name: 'Priya S', acquired_at: '2026-10-01T09:59:30.000Z' },
      { const_id: 'k2', user_id: 'u2', user_name: 'Rahul M', acquired_at: '2026-10-01T09:50:00.000Z' },
      { const_id: 'gone', user_id: 'u3', user_name: 'Mannu K', acquired_at: '2026-10-01T09:59:50.000Z' },
    ];
    expect(editingNow(locks, SEATS, NOW)).toEqual([
      { constId: 'k3', userName: 'Priya S', seat: '145 Bikram' },
      { constId: 'gone', userName: 'Mannu K', seat: 'gone' },
    ]);
  });

  it('seatLookup maps constituency and result ids', () => {
    const l = seatLookup(SEATS);
    expect(l.seatForConst('k2')).toBe('142 Patna Sahib');
    expect(l.seatForResult('c1')).toEqual({ seat: '145 Bikram', candidate: 'Cand c1' });
    expect(l.seatForConst('x')).toBeNull();
    expect(l.seatForResult('x')).toBeNull();
  });
});

describe('health summaries', () => {
  const status = {
    db: { ok: true, latencyMs: 12, pool: { connectionLimit: 5, poolTimeoutSeconds: null } },
    redis: { pubReady: true, subReady: true, publishes: 0, published: 0, publishErrors: 0 },
    live: { sseConnections: 1, eventsPublished: 0, overridesApplied: 0, overridesLast5m: 0, overridesPerMin: 18, lastOverrideAt: null },
  } as unknown as SystemStatus;

  it('from /admin/status (SUPER_ADMIN)', () => {
    expect(healthFromStatus(status)).toEqual({
      ok: true,
      rows: [
        { label: 'Database', detail: 'PostgreSQL', value: 'OK · 12 ms', ok: true },
        { label: 'Redis', detail: 'Cache and pub/sub', value: 'OK', ok: true },
        { label: 'Live updates (SSE)', detail: 'Admin streams', value: '1 connection', ok: true },
        { label: 'Overrides', detail: 'Last 5 min', value: '18 / min', ok: true },
      ],
    });
    const down = { ...status, redis: { ...status.redis, subReady: false } } as SystemStatus;
    expect(healthFromStatus(down).ok).toBe(false);
    expect(healthFromStatus(down).rows[1]).toEqual({ label: 'Redis', detail: 'Cache and pub/sub', value: 'Down', ok: false });
  });

  it('from /health/ready (EDITOR)', () => {
    const r = healthFromReadiness({ status: 'degraded', checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'unhealthy', latencyMs: 2000 } } });
    expect(r).toEqual({
      ok: false,
      rows: [
        { label: 'Database', detail: 'PostgreSQL', value: 'OK · 4 ms', ok: true },
        { label: 'Redis', detail: 'Cache and pub/sub', value: 'Down', ok: false },
      ],
    });
  });
});

describe('elections overview', () => {
  const e = (id: string, status: Election['status']): Election => ({ id, name: id, type: 'VS', state_id: 1, year: 2025, status, tentative_next_date: null, delimitation: null, manifest_url: null });
  it('groups by status and names each phase', () => {
    const g = groupElections([e('a', 'Live'), e('b', 'Upcoming'), e('c', 'Finalized'), e('d', 'Finalized')]);
    expect(g.live.map((x) => x.id)).toEqual(['a']);
    expect(g.upcoming.map((x) => x.id)).toEqual(['b']);
    expect(g.finalized.map((x) => x.id)).toEqual(['c', 'd']);
    expect(ELECTION_PHASE).toEqual({ Live: 'counting in progress', Upcoming: 'upcoming', Finalized: 'final results' });
  });
});
