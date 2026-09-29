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
