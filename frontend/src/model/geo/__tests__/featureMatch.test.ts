import { describe, it, expect } from 'vitest';
import { matchFeaturesToSeats } from '../featureMatch';
import type { GeoFeature } from '../geoHelpers';

const f = (props: Record<string, unknown>) => ({ type: 'Feature', properties: props, geometry: null }) as unknown as GeoFeature;

describe('matchFeaturesToSeats', () => {
  it('matches VS features by number+name and LS features by name, keeping same-named seats in different states apart', () => {
    const feats = [f({ ac_no: 128, ac_name: 'RAGHOPUR', st_name: 'Bihar' }), f({ pc_name: 'Aurangabad', st_name: 'Bihar' }), f({ pc_name: 'Aurangabad', st_name: 'Maharashtra' })];
    const seats = [
      { id: 'BR_VS_128_RAGHOPUR', name: 'Raghopur' },
      { id: 'BR_AURANGABAD', name: 'Aurangabad', state: 'Bihar' },
      { id: 'MH_AURANGABAD', name: 'Aurangabad', state: 'Maharashtra' },
    ];
    const m = matchFeaturesToSeats(feats, seats);
    expect([...m.values()]).toEqual(['BR_VS_128_RAGHOPUR', 'BR_AURANGABAD', 'MH_AURANGABAD']);
  });
});

describe('matchFeaturesToSeats byNumber (Vidhan Sabha maps)', () => {
  const feats = [f({ ac_no: 5, ac_name: 'MARCAIM', st_name: 'Goa' }), f({ ac_no: 41, ac_name: 'NOWHERE', st_name: 'Goa' })];
  const seats = [{ id: 'GA_VS22_5_MARCAIM_X', name: 'Marcaim (X)' }];
  it('matches a feature to the seat of its number when the names differ', () => {
    const m = matchFeaturesToSeats(feats, seats, { byNumber: true });
    expect(m.get(feats[0])).toBe('GA_VS22_5_MARCAIM_X');
    expect(m.has(feats[1])).toBe(false);
  });
  it('does not match by number alone without the option', () => {
    expect(matchFeaturesToSeats(feats, seats).has(feats[0])).toBe(false);
  });
});

describe('matchFeaturesToSeats byNumber: the number wins over a name that belongs to another seat', () => {
  it('a feature numbered 70 but named like seat 69 goes to seat 70 (tn_ac_2008: Gingee labelled VANDAVASI)', () => {
    const feats = [f({ ac_no: 69, ac_name: 'VANDAVASI', st_name: 'Tamil Nadu' }), f({ ac_no: 70, ac_name: 'VANDAVASI', st_name: 'Tamil Nadu' })];
    const seats = [{ id: 'TN_VS26_69_VANDAVASI', name: 'Vandavasi' }, { id: 'TN_VS26_70_GINGEE', name: 'Gingee' }];
    const m = matchFeaturesToSeats(feats, seats, { byNumber: true });
    expect([m.get(feats[0]), m.get(feats[1])]).toEqual(['TN_VS26_69_VANDAVASI', 'TN_VS26_70_GINGEE']);
  });
});
