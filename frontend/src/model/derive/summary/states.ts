import type { SeatResult } from '../../types/dashboard';
import { allianceByParty, ledSeats } from './shared';
import type { SummaryContext, SummarySection } from './types';

/** layerInsights.states — the alliance leading the most seats in each state, then states led per alliance. */
export function statesSummary(ctx: SummaryContext): SummarySection[] {
  if (ctx.electionType !== 'LS' || ctx.alliances.length === 0) return [];
  const al = allianceByParty(ctx.alliances);
  const byState = new Map<string, SeatResult[]>();
  ledSeats(ctx).forEach(s => { if (s.state) byState.set(s.state, [...(byState.get(s.state) ?? []), s]); });
  const leaders = new Map<string, { states: string[]; seatIds: string[] }>();
  for (const [state, seats] of byState) {
    const tally = new Map<string, number>();
    seats.forEach(s => { const a = al.get(s.party); if (a) tally.set(a.id, (tally.get(a.id) ?? 0) + 1); });
    const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
    if (!top) continue;
    const e = leaders.get(top[0]) ?? { states: [], seatIds: [] };
    e.states.push(state);
    e.seatIds.push(...seats.map(s => s.id));
    leaders.set(top[0], e);
  }
  if (leaders.size === 0) return [];
  return [{
    id: 'states_by_alliance', titleKey: 'studio_sum_states_by_alliance',
    rows: [...leaders.entries()].sort((x, y) => y[1].states.length - x[1].states.length).map(([id, e]) => {
      const a = ctx.alliances.find(x => x.id === id)!;
      return {
        id: `alliance:${id}`, label: a.name, sub: [...e.states].sort((p, q) => p.localeCompare(q)).join(', '),
        value: e.states.length, valueFormat: 'int' as const, color: a.color, partyIds: a.parties, seatIds: e.seatIds,
      };
    }),
  }];
}
