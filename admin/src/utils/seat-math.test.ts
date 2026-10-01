import { describe, it, expect } from 'vitest';
import { parseVotes, rankSeat, seatMargin, deriveStatuses, buildSeatOverrides, seatStatus, type SeatRow } from './seat-math';

const row = (id: string, votes: number, party = id.toUpperCase(), status: SeatRow['status'] = 'TRAILING'): SeatRow => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: id, party_id: party, party_abbr: party, party_color: null, votes, status,
});

describe('parseVotes', () => {
  it.each([['61,204', 61204], [' 61204 ', 61204], ['0', 0], ['1 20 000', 120000]])('%s → %s', (raw, n) => {
    expect(parseVotes(raw)).toBe(n);
  });
  it.each(['', '61.2', '-5', 'abc', '1e5'])('rejects %s', (raw) => {
    expect(parseVotes(raw)).toBeNull();
  });
});

describe('rankSeat / seatMargin', () => {
  it('leader and runner-up by votes', () => {
    const r = rankSeat([row('b', 48990), row('a', 61204), row('c', 9310)]);
    expect(r.leader?.result_id).toBe('a');
    expect(r.runnerUp?.result_id).toBe('b');
    expect(r.tie).toBe(false);
    expect(seatMargin([row('b', 48990), row('a', 61204)])).toBe(12214);
  });
  it('NOTA is never the leader', () => {
    const r = rankSeat([row('n', 9000, 'NOTA'), row('a', 100)]);
    expect(r.leader?.result_id).toBe('a');
  });
  it('tie at the top → no leader', () => {
    const r = rankSeat([row('a', 100), row('b', 100)]);
    expect(r.leader).toBeNull();
    expect(r.tie).toBe(true);
    expect(seatMargin([row('a', 100), row('b', 100)])).toBe(0);
  });
  it('all zero → no leader', () => {
    expect(rankSeat([row('a', 0), row('b', 0)]).leader).toBeNull();
  });
  it('single candidate margin = own votes', () => {
    expect(seatMargin([row('a', 50)])).toBe(50);
  });
});

describe('deriveStatuses', () => {
  it('counting: leader LEADING, others and NOTA TRAILING', () => {
    const out = deriveStatuses([row('a', 10), row('b', 5), row('n', 99, 'NOTA')], false);
    expect(out.map((r) => r.status)).toEqual(['LEADING', 'TRAILING', 'TRAILING']);
  });
  it('declared: leader WON, others LOST', () => {
    const out = deriveStatuses([row('a', 10), row('b', 5)], true);
    expect(out.map((r) => r.status)).toEqual(['WON', 'LOST']);
  });
  it('tie: everyone TRAILING even if declared requested', () => {
    expect(deriveStatuses([row('a', 5), row('b', 5)], true).map((r) => r.status)).toEqual(['TRAILING', 'TRAILING']);
  });
});

describe('buildSeatOverrides', () => {
  it('margin convention: leader lead over runner-up, others gap to leader', () => {
    const items = buildSeatOverrides([row('a', 61204, 'BJP', 'LEADING'), row('b', 48990), row('n', 1120, 'NOTA')]);
    expect(items).toEqual([
      { result_id: 'a', votes: 61204, status: 'LEADING', margin: 12214 },
      { result_id: 'b', votes: 48990, status: 'TRAILING', margin: 12214 },
      { result_id: 'n', votes: 1120, status: 'TRAILING', margin: 60084 },
    ]);
  });
  it('no leader → every margin 0', () => {
    expect(buildSeatOverrides([row('a', 0), row('b', 0)]).map((i) => i.margin)).toEqual([0, 0]);
  });
});

describe('seatStatus', () => {
  const base = { const_id: 'c', const_name: 'X', const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null };
  const cand = (status: string, votes: number) => ({ result_id: 'r', candidate_id: 'c', candidate_name: 'n', party_id: 'P', party_name: 'P', party_color: null, party_abbr: 'P', votes, status, margin: 0, last_updated: '' });
  it('PENDING when no votes', () => expect(seatStatus({ ...base, candidates: [cand('TRAILING', 0)] })).toBe('PENDING'));
  it('WON when any candidate WON', () => expect(seatStatus({ ...base, candidates: [cand('WON', 5)] })).toBe('WON'));
  it('LEADING otherwise', () => expect(seatStatus({ ...base, candidates: [cand('LEADING', 5)] })).toBe('LEADING'));
});
