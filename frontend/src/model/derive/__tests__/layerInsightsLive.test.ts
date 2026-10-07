import { describe, it, expect } from 'vitest';
import { deriveLayerInsight } from '../layerInsights';
import type { SeatLive } from '../seatAnalysis';
import type { SeatResult } from '../../types/dashboard';

const seats = ['A', 'B', 'C', 'D'].map(id => ({ id, party: 'BJP', margin: 100, status: 'LEADING', name: id })) as unknown as SeatResult[];
const live = new Map<string, SeatLive>([
  ['A', { const_id: 'A', call: 'too_close', momentum: 'narrowing', comeback: false, lead_changes: 2, upsets: ['sitting_trailing'] } as unknown as SeatLive],
  ['B', { const_id: 'B', call: 'too_close', momentum: 'switched', comeback: true, lead_changes: 3, upsets: [] } as unknown as SeatLive],
  ['C', { const_id: 'C', call: 'safe', momentum: 'widening', comeback: false, lead_changes: 0, upsets: [] } as unknown as SeatLive],
  ['D', { const_id: 'D', call: 'declared', momentum: null, comeback: false, lead_changes: 1, upsets: [] } as unknown as SeatLive],
]);
const base = { electionType: 'VS' as const, seats, alliances: [], partyColor: new Map([['BJP', '#f80']]) };

describe('live insights', () => {
  it('Overview adds a Too close chip while live (and only while live)', () => {
    const chip = deriveLayerInsight('overview', { ...base, live })!.chips.find(c => c.id === 'too_close')!;
    expect(chip).toMatchObject({ count: 2, seatIds: ['A', 'B'], labelKey: 'studio_chip_too_close' });
    expect(deriveLayerInsight('overview', base)!.chips.some(c => c.id === 'too_close')).toBe(false);
  });
  it('Battle live: lead changes headline and momentum / comeback / upset chips', () => {
    const ins = deriveLayerInsight('battle', { ...base, live })!;
    expect(ins.headlineKey).toBe('studio_insight_battle_live');
    expect(ins.headlineParams).toEqual({ n: 6 });
    expect(ins.chips.map(c => [c.id, c.count])).toEqual([['mo_switched', 1], ['mo_narrowing', 1], ['mo_widening', 1], ['comebacks', 1], ['upsets', 1]]);
  });
  it('Battle not live keeps the margin buckets', () => {
    expect(deriveLayerInsight('battle', base)!.headlineKey).toBe('studio_insight_battle');
  });
});
