import { describe, it, expectTypeOf } from 'vitest';
import type { SeatResult, PartySeats, LayerId } from '../dashboard';
import type { MapTab } from '../index';

describe('dashboard model types', () => {
  it('LayerId covers every legacy MapTab', () => {
    expectTypeOf<MapTab>().toMatchTypeOf<LayerId>();
  });
  it('SeatResult and PartySeats have the fields the derive layer needs', () => {
    expectTypeOf<SeatResult>().toHaveProperty('margin');
    expectTypeOf<PartySeats>().toHaveProperty('seats');
  });
});
