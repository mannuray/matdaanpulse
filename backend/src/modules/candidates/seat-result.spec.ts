import { seatResult } from './seat-result';

const cand = (id: string, party: string, votes: number | null, status: string, margin: number | null = null) => ({
  id, name: id, party_id: party,
  results: votes === null && status === '' ? [] : [{ votes, status, margin }],
});

describe('seatResult', () => {
  it('ranks by votes and gives losers a negative margin to the winner', () => {
    const r = seatResult('b', true, [cand('a', 'X', 600, 'WON', 200), cand('b', 'Y', 400, 'LOST'), cand('n', 'NOTA', 10, 'LOST')]);
    expect(r.seat.map((s) => [s.candidate_id, s.position, s.margin])).toEqual([['a', 1, 200], ['b', 2, -200], ['n', null, null]]);
  });

  it('never gives a loser a positive margin when the flagged winner has fewer votes', () => {
    const r = seatResult('b', false, [cand('a', 'X', 300, 'LEADING', 5), cand('b', 'Y', 500, 'TRAILING')]);
    expect(r.seat.find((s) => s.candidate_id === 'b')!.margin).toBe(0);
  });

  it('a WON row without votes in a seat that has votes does not share position 1', () => {
    const r = seatResult('a', true, [cand('a', 'X', null, 'WON', 100), cand('b', 'Y', 500, 'LOST'), cand('c', 'Z', 300, 'LOST')]);
    const pos = Object.fromEntries(r.seat.map((s) => [s.candidate_id, s.position]));
    expect(pos).toEqual({ b: 1, c: 2, a: null });
    expect(r.seat[0].candidate_id).toBe('b');
    expect(r.seat.filter((s) => s.position === 1)).toHaveLength(1);
  });

  it('with no votes anywhere only the winner has a position and nothing is NaN', () => {
    const r = seatResult('a', true, [cand('a', 'X', 0, 'WON', 1200), cand('b', 'Y', 0, 'LOST')]);
    expect(r.total_votes).toBe(0);
    expect(r.seat.map((s) => [s.position, s.share, s.margin])).toEqual([[1, null, 1200], [null, null, null]]);
  });
});
