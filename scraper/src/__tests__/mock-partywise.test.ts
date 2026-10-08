import { describe, it, expect } from 'vitest';
import { partywiseRows, renderPartywise } from '../simulation/mock-partywise';
import { parsePartywisePage } from '../live/adapters/eci-parse';

const snap = (status: string, cands: [string, number][]) => ({ status, candidates: cands.map(([partyName, votes]) => ({ partyName, votes })) });

describe('mock ECI party-wise page', () => {
  it('counts declared seats as won and counting leaders as leading; an exact tie counts for nobody (as the backend)', () => {
    const rows = partywiseRows([
      snap('Result Declared', [['BJP', 900], ['INC', 800]]),
      snap('Round 5', [['INC', 500], ['BJP', 400]]),
      snap('Round 2', [['BJP', 35], ['RJD', 35]]),
      null,
    ]);
    expect(rows).toEqual([{ party: 'BJP', won: 1, leading: 0 }, { party: 'INC', won: 0, leading: 1 }]);
  });
  it('renders a page the real adapter parses back to the same rows', () => {
    const rows = [{ party: 'Bharatiya Janata Party', won: 3, leading: 2 }, { party: 'Janata Dal (United)', won: 0, leading: 4 }];
    expect(parsePartywisePage(renderPartywise(rows))).toEqual(rows);
  });
});
