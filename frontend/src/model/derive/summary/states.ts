import { displayStateName, stateFromConstId } from '../../geo/regionMatching';
import { allianceByParty, colorOf, wonSeats } from './shared';
import type { SummaryContext, SummarySection } from './types';

const LEADERBOARD_LIMIT = 10;
const COMPETITIVE_LIMIT = 5;
const SWEEP_PCT = 80;

/** StatesSection.tsx (Lok Sabha only): state leaderboard, sweep states and the most competitive states. */
export function statesSummary(ctx: SummaryContext): SummarySection[] {
  if (ctx.electionType === 'VS') return [];
  const al = allianceByParty(ctx.alliances);
  interface Tally { key: string; name: string; color: string; partyIds: string[]; count: number }
  const states = new Map<string, { code: string; seats: string[]; margins: number; marginSum: number; tally: Map<string, Tally> }>();
  for (const s of wonSeats(ctx)) {
    const code = s.state || stateFromConstId(s.id);
    if (!code) continue;
    const st = states.get(code) ?? { code, seats: [], margins: 0, marginSum: 0, tally: new Map<string, Tally>() };
    st.seats.push(s.id);
    if (s.margin != null) { st.margins++; st.marginSum += s.margin; } // a seat won unopposed has no margin
    const a = al.get(s.party);
    const key = a ? a.name : s.party;
    const t = st.tally.get(key) ?? { key, name: key, color: a ? a.color : colorOf(ctx, s.party), partyIds: a ? a.parties : [s.party], count: 0 };
    t.count++;
    st.tally.set(key, t);
    states.set(code, st);
  }
  const stats = [...states.values()].map(st => {
    let dominant: Tally | null = null;
    for (const t of st.tally.values()) if (!dominant || t.count > dominant.count) dominant = t;
    return {
      code: st.code, name: displayStateName(st.code), seatIds: st.seats, seats: st.seats.length,
      avgMargin: st.margins ? Math.round(st.marginSum / st.margins) : 0, dominant: dominant!,
      dominantPct: Math.round((dominant!.count / st.seats.length) * 100),
    };
  }).sort((a, b) => b.seats - a.seats);
  if (stats.length === 0) return [];

  const max = stats[0].seats;
  const out: SummarySection[] = [{
    id: 'state_leaderboard', titleKey: 'studio_sum_state_leaderboard',
    rows: stats.slice(0, LEADERBOARD_LIMIT).map(s => ({
      id: `state:${s.code}`, label: s.name, sub: s.dominant.name, value: s.seats, valueFormat: 'int' as const,
      color: s.dominant.color, seatIds: s.seatIds, partyIds: s.dominant.partyIds, bar: { value: s.seats, max, color: s.dominant.color },
    })),
  }];
  const sweep = stats.filter(s => s.dominantPct >= SWEEP_PCT);
  if (sweep.length > 0) {
    out.push({
      id: 'sweep_states', titleKey: 'studio_sum_sweep_states', titleParams: { count: sweep.length },
      rows: sweep.map(s => ({
        id: `state:${s.code}`, label: s.name, sub: s.dominant.name, value: s.dominantPct, valueFormat: 'pct0' as const,
        color: s.dominant.color, seatIds: s.seatIds, partyIds: s.dominant.partyIds,
      })),
    });
  }
  out.push({
    id: 'competitive_states', titleKey: 'studio_sum_competitive_states',
    rows: [...stats].sort((a, b) => a.avgMargin - b.avgMargin).slice(0, COMPETITIVE_LIMIT).map(s => ({
      id: `state:${s.code}`, label: s.name, value: s.avgMargin, valueFormat: 'compact' as const, seatIds: s.seatIds,
    })),
  });
  return out;
}
