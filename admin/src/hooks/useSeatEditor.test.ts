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

  it('build returns votes by candidate id, the seat state and the rounds', () => {
    const s = seat();
    const { result } = renderHook(() => useSeatEditor(s));
    act(() => result.current.setVotes(s.candidates[0].result_id, '500'));
    expect(result.current.build(false)).toEqual({ ok: true, save: { state: 'counting', round: { current: 4, total: 24 }, votes: { [s.candidates[0].candidate_id]: 500, [s.candidates[1].candidate_id]: s.candidates[1].votes } } });
    expect(result.current.build(true)).toMatchObject({ ok: true, save: { state: 'declared' } });
  });

  it('one round field empty is an error; both empty is no round', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setRound('total', ''));
    expect(result.current.build(false)).toEqual({ ok: false, error: 'Fill both round fields or neither' });
    act(() => result.current.setRound('current', ''));
    expect(result.current.build(false)).toMatchObject({ ok: true, save: { round: null } });
  });

  it('the seat state can be set to countermanded', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setSeatState('countermanded'));
    expect(result.current.dirty).toBe(true);
    expect(result.current.build(false)).toMatchObject({ ok: true, save: { state: 'countermanded' } });
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

  it('a declared seat starts in the declared state and previews WON on the leader; a correction flags a winner who is no longer ahead', () => {
    const { result } = renderHook(() => useSeatEditor(seat({ candidates: [cand('a', 100, 'WON'), cand('b', 80, 'LOST')] })));
    expect(result.current.seatState).toBe('declared');
    expect(result.current.winnerNotLeader).toBe(false);
    act(() => result.current.setVotes('b', '120'));
    expect(result.current.rows.map((r) => r.status)).toEqual(['LOST', 'WON']);
    expect(result.current.leaderId).toBe('b');
    expect(result.current.winnerNotLeader).toBe(true);
  });
});
