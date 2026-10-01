// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSeatEditor } from './useSeatEditor';
import type { LiveConstituency } from '../types';

const cand = (id: string, votes: number, status = 'TRAILING', party = id.toUpperCase()) => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: id, party_id: party, party_name: party, party_color: null, party_abbr: party,
  votes, status, margin: 0, last_updated: '',
});
const seat = (over: Partial<LiveConstituency> = {}): LiveConstituency => ({
  const_id: 's1', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24,
  candidates: [cand('a', 100, 'LEADING'), cand('b', 80)], ...over,
});

describe('useSeatEditor', () => {
  it('re-derives statuses and margin as votes change', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setVotes('b', '120'));
    expect(result.current.leaderId).toBe('b');
    expect(result.current.rows.find((r) => r.result_id === 'b')?.status).toBe('LEADING');
    expect(result.current.margin).toBe(20);
    expect(result.current.dirty).toBe(true);
  });

  it('keeps edits and flags changedElsewhere when the server data changes while dirty', () => {
    const { result, rerender } = renderHook(({ s }) => useSeatEditor(s), { initialProps: { s: seat() } });
    act(() => result.current.setVotes('a', '150'));
    rerender({ s: seat({ candidates: [cand('a', 110, 'LEADING'), cand('b', 80)] }) });
    expect(result.current.rows.find((r) => r.result_id === 'a')?.draftVotes).toBe('150');
    expect(result.current.changedElsewhere).toBe(true);
    act(() => result.current.discard());
    expect(result.current.rows.find((r) => r.result_id === 'a')?.draftVotes).toBe('110');
    expect(result.current.changedElsewhere).toBe(false);
  });

  it('adopts server data silently when not dirty', () => {
    const { result, rerender } = renderHook(({ s }) => useSeatEditor(s), { initialProps: { s: seat() } });
    rerender({ s: seat({ candidates: [cand('a', 110, 'LEADING'), cand('b', 80)] }) });
    expect(result.current.rows[0].draftVotes).toBe('110');
    expect(result.current.changedElsewhere).toBe(false);
  });

  it('build rejects bad votes inline', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setVotes('a', '61.2'));
    expect(result.current.rows[0].error).toBe('Whole number of 0 or more');
    expect(result.current.build(false)).toEqual({ ok: false, error: 'Fix the highlighted votes' });
  });

  it('build(true) declares the leader WON and others LOST, with rounds', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setRound('current', '24'));
    const out = result.current.build(true);
    expect(out.ok && out.overrides.map((o) => o.status)).toEqual(['WON', 'LOST']);
    expect(out.ok && out.rounds).toEqual({ current_round: 24, total_rounds: 24 });
  });

  it('after markSaved, the reload caused by our own save is adopted silently', () => {
    const { result, rerender } = renderHook(({ s }) => useSeatEditor(s), { initialProps: { s: seat() } });
    act(() => result.current.setVotes('a', '150'));
    act(() => result.current.markSaved());
    rerender({ s: seat({ candidates: [cand('a', 150, 'LEADING'), cand('b', 80)] }) });
    expect(result.current.changedElsewhere).toBe(false);
    expect(result.current.dirty).toBe(false);
    expect(result.current.rows[0].draftVotes).toBe('150');
  });

  it('a manual status pick is kept when votes change', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setStatus('b', 'LOST'));
    act(() => result.current.setVotes('a', '101'));
    expect(result.current.rows.find((r) => r.result_id === 'b')?.status).toBe('LOST');
  });

  it('a declared seat keeps its statuses when votes are corrected, and flags a winner who is no longer ahead', () => {
    const { result } = renderHook(() => useSeatEditor(seat({ candidates: [cand('a', 100, 'WON'), cand('b', 80, 'LOST')] })));
    expect(result.current.winnerNotLeader).toBe(false);
    act(() => result.current.setVotes('b', '120'));
    expect(result.current.rows.map((r) => r.status)).toEqual(['WON', 'LOST']);
    expect(result.current.leaderId).toBe('b');
    expect(result.current.winnerNotLeader).toBe(true);
  });
});
