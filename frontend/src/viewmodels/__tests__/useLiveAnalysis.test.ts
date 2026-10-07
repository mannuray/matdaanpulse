// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLiveAnalysis } from '../data/useLiveAnalysis';
import type { Baseline } from '../../model/derive/seatAnalysis';
import type { ResultRow } from '../../model/types';

const baseline = { schema_version: 1, election_id: 'e', date: '2027-02-27', state_id: 1, lineage: [], alliances: [], seats: [] } as unknown as Baseline;
const rows: ResultRow[] = [
  { const_id: 'S1', party_id: 'BJP', candidate_name: 'A', votes: 600, status: 'LEADING', margin: 100 },
  { const_id: 'S1', party_id: 'SP', candidate_name: 'B', votes: 500, status: 'TRAILING', margin: 0 },
];

describe('useLiveAnalysis', () => {
  it('one SeatLive per seat with results; round from the seat state; no trail → no momentum', () => {
    const { result } = renderHook(() => useLiveAnalysis(baseline, rows, { S1: { state: 'counting', cr: 4, tr: 20 } }, {}));
    const s = result.current!.seats.get('S1')!;
    expect(s).toMatchObject({ leader: { name: 'A' }, margin: 100, remaining: 4400, momentum: null });
    expect(result.current!.tally.parties[0]).toMatchObject({ party_id: 'BJP', leading: 1 });
  });
  it('no baseline → null', () => {
    expect(renderHook(() => useLiveAnalysis(null, rows, {}, {})).result.current).toBeNull();
  });
});
