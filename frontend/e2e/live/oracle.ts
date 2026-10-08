import type { APIRequestContext } from '@playwright/test';
import { analyseLive, type Baseline, type SeatLive, type SeatTrail } from '../../src/model/derive/seatAnalysis';
import type { ResultRow } from '../../src/model/types';
import { API, SIM } from './env';
import type { Snapshot } from './sim';

export async function baseline(request: APIRequestContext): Promise<Baseline> {
  const res = await request.get(`${API}/elections/${SIM}/baseline`);
  if (!res.ok()) throw new Error(`GET /baseline HTTP ${res.status()}`);
  return ((await res.json()) as { data: Baseline }).data;
}

/** The live analysis a viewer computes for this snapshot (same input as viewmodels/data/useLiveAnalysis.ts). */
export function liveOf(b: Baseline, snap: Snapshot): Map<string, SeatLive> {
  const byConst = new Map<string, ResultRow[]>();
  for (const r of snap.results) (byConst.get(r.const_id) ?? byConst.set(r.const_id, []).get(r.const_id)!).push(r);
  const input = [...byConst].map(([const_id, rows]) => {
    const st = snap.seats?.[const_id];
    return { const_id, candidates: rows.map(r => ({ person_id: r.person_id ?? null, name: r.candidate_name, party_id: r.party_id || null, votes: Number(r.votes) || 0, status: r.status })),
      round: st?.cr && st.tr ? { current: st.cr, total: st.tr } : null, trail: (snap.trail?.[const_id] as SeatTrail | undefined) ?? null };
  });
  return new Map(analyseLive(b, input).seats.map(s => [s.const_id, s]));
}

/** Leader per seat as the backend marks it (LEADING / WON; a tied seat has none). */
export function leadersOf(snap: Snapshot): Map<string, { party: string; won: boolean; votes: number }> {
  const m = new Map<string, { party: string; won: boolean; votes: number }>();
  for (const r of snap.results) if (r.status === 'LEADING' || r.status === 'WON') m.set(r.const_id, { party: r.party_id, won: r.status === 'WON', votes: r.votes });
  return m;
}
