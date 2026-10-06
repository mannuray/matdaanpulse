import { describe, it, expect } from 'vitest';
import { makeComparer, RAW_COMPARER } from '../partyComparer';

const events = [
  { party_id: 'BRS', predecessor_id: 'TRS', kind: 'rename', effective_date: '2022-12-09', state_id: null, is_successor: true },
  { party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false },
];
const dates = new Map([[2018, '2018-12-11'], [2019, '2019-10-24'], [2023, '2023-12-03'], [2024, '2024-11-23']]);

describe('makeComparer', () => {
  const cmp = makeComparer(events, dates, 32);
  it('relates parties between two election years', () => {
    expect(cmp.relation('TRS', 'BRS', 2018, 2023)).toBe('same');
    expect(cmp.relation('SHS', 'SSUBT', 2019, 2024)).toBe('split');
    expect(cmp.relation('BJP', 'INC', 2019, 2024)).toBe('different');
  });
  it('carries a party forward to a later year', () => {
    expect(cmp.carry('TRS', 2018, 2023)).toBe('BRS');
  });
  it('a year without a known date uses mid-year', () => {
    expect(makeComparer(events, new Map(), 32).relation('TRS', 'BRS', 2018, 2023)).toBe('same');
  });
  it('the raw comparer is plain id equality (no lineage loaded)', () => {
    expect(RAW_COMPARER.relation('TRS', 'BRS', 2018, 2023)).toBe('different');
    expect(RAW_COMPARER.carry('TRS', 2018, 2023)).toBe('TRS');
  });
});
