import { describe, it, expect } from 'vitest';
import { applyLiveRows, mergeWinnerOverlay, appendToasts, MAX_TOASTS } from '../utils/liveUpdates';
import type { LeaderPatch } from '../utils/liveUpdates';
import type { ResultRow } from '../types';

const row = (const_id: string, party_id: string, status: string, votes = 100, margin = 10): ResultRow =>
  ({ const_id, party_id, status, votes, margin, candidate_name: `${party_id} cand` });

const base = new Map<string, ResultRow>([['AGRA', row('AGRA', 'BJP', 'LEADING')]]);

describe('applyLiveRows', () => {
  it('records a leader change when a different party takes the lead', () => {
    const { overlay, changes } = applyLiveRows(new Map(), [{ const_id: 'AGRA', p: 'SP', m: 1200, s: 'LEADING' }], base);
    expect(overlay.get('AGRA')).toEqual({ party_id: 'SP', margin: 1200, status: 'LEADING' });
    expect(changes).toEqual([{ const_id: 'AGRA', party_id: 'SP', prevParty: 'BJP', margin: 1200, kind: 'lead' }]);
  });

  it('ignores TRAILING rows (they do not identify the leader)', () => {
    const empty = new Map<string, LeaderPatch>();
    const { overlay, changes } = applyLiveRows(empty, [{ const_id: 'AGRA', p: 'SP', m: 0, s: 'TRAILING' }], base);
    expect(overlay).toBe(empty);
    expect(changes).toEqual([]);
  });

  it('updates margin silently when the same party keeps leading', () => {
    const { overlay, changes } = applyLiveRows(new Map(), [{ const_id: 'AGRA', p: 'BJP', m: 5000, s: 'LEADING' }], base);
    expect(overlay.get('AGRA')?.margin).toBe(5000);
    expect(changes).toEqual([]);
  });

  it('reports a declaration when the leader is declared WON', () => {
    const { changes } = applyLiveRows(new Map(), [{ const_id: 'AGRA', p: 'BJP', m: 5000, s: 'WON' }], base);
    expect(changes).toMatchObject([{ const_id: 'AGRA', party_id: 'BJP', kind: 'won' }]);
  });

  it('applies batch rows sequentially against the evolving overlay', () => {
    const { changes } = applyLiveRows(new Map(), [
      { const_id: 'X', p: 'INC', m: 1, s: 'LEADING' },
      { const_id: 'X', p: 'INC', m: 2, s: 'LEADING' },
      { const_id: 'X', p: 'BJP', m: 3, s: 'LEADING' },
    ], new Map());
    expect(changes.map(c => c.party_id)).toEqual(['INC', 'BJP']);
  });
});

describe('mergeWinnerOverlay', () => {
  it('overrides winners and pulls candidate names from fetched rows', () => {
    const cands = new Map([['AGRA', [row('AGRA', 'BJP', 'LEADING', 200), row('AGRA', 'SP', 'TRAILING', 150)]]]);
    const overlay = new Map<string, LeaderPatch>([['AGRA', { party_id: 'SP', margin: 99, status: 'WON' }]]);
    const merged = mergeWinnerOverlay(base, overlay, cands);
    expect(merged.get('AGRA')).toMatchObject({ party_id: 'SP', status: 'WON', margin: 99, candidate_name: 'SP cand' });
    expect(base.get('AGRA')?.party_id).toBe('BJP');
  });

  it('returns the base map when there is nothing to overlay', () => {
    expect(mergeWinnerOverlay(base, new Map(), new Map())).toBe(base);
  });
});

describe('appendToasts', () => {
  const resolve = (p: string, c: string) => ({ party: `${p} name`, color: '#123456', constName: c });

  it('builds toasts with party name and constituency', () => {
    const out = appendToasts([], [{ const_id: 'AGRA', party_id: 'SP', margin: 5, kind: 'lead' }], resolve, 1);
    expect(out).toEqual([{ id: 'AGRA-1-0', constName: 'AGRA', party: 'SP name', color: '#123456', margin: 5, kind: 'lead', timestamp: 1 }]);
  });

  it('caps the number of toasts, keeping the newest', () => {
    const changes = Array.from({ length: MAX_TOASTS + 3 }, (_, i) => ({ const_id: `C${i}`, party_id: 'P', margin: i, kind: 'lead' as const }));
    const out = appendToasts([], changes, resolve, 1);
    expect(out).toHaveLength(MAX_TOASTS);
    expect(out[out.length - 1].constName).toBe(`C${MAX_TOASTS + 2}`);
  });
});
