import { describe, it, expectTypeOf } from 'vitest';
import type { SeatResult, PartySeats, LayerId } from '../dashboard';

describe('dashboard model types', () => {
  it('LayerId names the map layers', () => {
    expectTypeOf<'overview'>().toMatchTypeOf<LayerId>();
  });
  it('SeatResult and PartySeats have the fields the derive layer needs', () => {
    expectTypeOf<SeatResult>().toHaveProperty('margin');
    expectTypeOf<PartySeats>().toHaveProperty('seats');
  });
});
