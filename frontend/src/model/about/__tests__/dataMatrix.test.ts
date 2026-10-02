import { describe, it, expect } from 'vitest';
import { DATA_SOURCES, dataMatrix, type DataSource } from '../about';

const src = (house: 'LS' | 'VS', state: string | null, year: number): DataSource => ({ house, state, year, source: null, quality: 'real', notes: [] });

describe('dataMatrix', () => {
  it('years oldest first, one row per house + state in source order, a cell per dataset', () => {
    const m = dataMatrix([src('LS', null, 2024), src('VS', 'Bihar', 2025), src('VS', 'Bihar', 2010), src('VS', 'Kerala', 2016)]);
    expect(m.years).toEqual([2010, 2016, 2024, 2025]);
    expect(m.rows.map(r => r.state)).toEqual([null, 'Bihar', 'Kerala']);
    expect([...m.rows[1].cells.keys()]).toEqual([2025, 2010]);
    expect(m.rows[2].cells.get(2024)).toBeUndefined();
    expect(m.states).toBe(2);
  });

  it('covers every dataset exactly once', () => {
    const m = dataMatrix(DATA_SOURCES);
    expect(m.rows.reduce((n, r) => n + r.cells.size, 0)).toBe(DATA_SOURCES.length);
  });
});
