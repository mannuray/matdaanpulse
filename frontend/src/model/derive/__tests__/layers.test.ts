import { describe, it, expect } from 'vitest';
import { LAYER_IDS, availableLayers } from '../layers';

describe('layer registry', () => {
  it('lists every layer once, in menu order', () => {
    expect(LAYER_IDS).toEqual(['overview', 'battle', 'swing', 'history', 'regions', 'demographics', 'insights', 'states']);
  });
  it('a VS election without history data: Regions but no Swing / History / States', () => {
    expect(availableLayers({ electionType: 'VS', hasSwing: false, hasHistory: false }))
      .toEqual(['overview', 'battle', 'regions', 'demographics', 'insights']);
  });
  it('an LS election: States instead of Regions', () => {
    expect(availableLayers({ electionType: 'LS', hasSwing: false, hasHistory: false }))
      .toEqual(['overview', 'battle', 'demographics', 'insights', 'states']);
  });
  it('Swing and History follow their data', () => {
    expect(availableLayers({ electionType: 'VS', hasSwing: true, hasHistory: false })).toContain('swing');
    expect(availableLayers({ electionType: 'VS', hasSwing: true, hasHistory: false })).not.toContain('history');
    expect(availableLayers({ electionType: 'LS', hasSwing: true, hasHistory: true }))
      .toEqual(['overview', 'battle', 'swing', 'history', 'demographics', 'insights', 'states']);
  });
});
