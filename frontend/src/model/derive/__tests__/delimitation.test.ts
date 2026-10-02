import { describe, it, expect } from 'vitest';
import { redrawnTo } from '../delimitation';

const el = (id: string, year: number, delimitation: string | null, state_id: number | null = 4, type: 'LS' | 'VS' = 'VS') => ({ id, type, state_id, year, delimitation });

describe('redrawnTo', () => {
  const as21 = el('as21', 2021, '2008'), as26 = el('as26', 2026, '2023');
  it('the first election on new boundaries names its delimitation', () => {
    expect(redrawnTo(as26, [as21, as26])).toBe('2023');
  });
  it('same boundaries, a later election, another state or house, or an unknown delimitation: null', () => {
    expect(redrawnTo(as21, [as21, as26])).toBeNull();
    expect(redrawnTo(el('as31', 2031, '2023'), [as26, el('as31', 2031, '2023')])).toBe(null);
    expect(redrawnTo(as26, [as26, el('kl21', 2021, '2008', 9), el('ls24', 2024, '2008', null, 'LS')])).toBeNull();
    expect(redrawnTo(el('x', 2026, null), [as21])).toBeNull();
    expect(redrawnTo(as26, [as26, el('old', 2021, null)])).toBeNull();
  });
});
