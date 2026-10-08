import { analyseLive } from './live';
import { baselineOf } from './baseline';
import { analyse } from './index';
import { el, input, seat, JVM_MERGER } from './fixtures';
import type { CandidateIn, SeatLiveIn, SeatTrail } from './types';

const c = (name: string, party: string, votes: number, status = 'TRAILING'): CandidateIn => ({ person_id: null, name, party_id: party, votes, status });
const live = (cands: CandidateIn[], round: { current: number; total: number } | null = null, trail: SeatTrail | null = null): SeatLiveIn => ({ const_id: 'T_1', candidates: cands, round, trail });
const prev = el(2019, [seat(1, [['A', 'JVM', 55], ['B', 'JMM', 45]])]);
const base = (cur = el(2024, [seat(1, [['A', 'BJP', 0, 'PENDING'], ['B', 'JMM', 0, 'PENDING']])]), extra = {}) =>
  baselineOf(input(cur, [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])]), prev], { lineage: [JVM_MERGER], ...extra }));

describe('analyseLive', () => {
  it('before any votes: not_started, no outcome, sitting MLA not_started (never lost)', () => {
    const s = analyseLive(base(), [live([c('A', 'BJP', 0), c('B', 'JMM', 0)])]).seats[0];
    expect(s).toMatchObject({ call: 'not_started', outcome: null, sitting: 'not_started', upsets: [] });
  });
  it('an exact tie while counting (no LEADING row) is too close, not not_started', () => {
    const s = analyseLive(base(), [live([c('A', 'BJP', 35), c('B', 'JMM', 35)], { current: 2, total: 24 })]).seats[0];
    expect(s.call).toBe('too_close');
    expect(s.outcome).toBeNull();
  });
  it('a lead is a provisional outcome; remaining from rounds; call by lead / remaining', () => {
    const s = analyseLive(base(), [live([c('B', 'JMM', 5200, 'LEADING'), c('A', 'BJP', 5000)], { current: 5, total: 20 })]).seats[0];
    expect(s.outcome).toEqual({ kind: 'gained', from: 'BJP', from_raw: 'JVM' });
    expect(s.provisional).toBe(true);
    expect(s.remaining).toBe(30600);            // 10200 / 5 * 15
    expect(s.call).toBe('too_close');           // 200 / 30600 < 0.05
    expect(s.sitting).toBe('trailing');
    expect(s.upsets).toEqual(['sitting_trailing']);
  });
  it('safe / likely / declared / counting without rounds or electors', () => {
    const run = (a: number, b: number, round: { current: number; total: number } | null, st = 'LEADING') => analyseLive(base(), [live([c('A', 'BJP', a, st), c('B', 'JMM', b)], round)]).seats[0].call;
    expect(run(9000, 5000, { current: 10, total: 12 })).toBe('safe');       // 4000 / 2800
    expect(run(6000, 5000, { current: 8, total: 12 })).toBe('likely');      // 1000 / 5500 ≈ 0.18
    expect(run(9000, 5000, { current: 12, total: 12 }, 'WON')).toBe('declared');
    expect(run(6000, 5000, null)).toBe('counting');
  });
  it('momentum and comeback from the trail; lead changes from the server', () => {
    const trail = (pts: [string, number, number][], lc = 0): SeatTrail => ({ points: pts.map(([lp, m, v], i) => ({ r: i + 1, lp, m, v })), lc, pk: null });
    const at = (t: SeatTrail, cands: CandidateIn[]) => analyseLive(base(), [live(cands, { current: 6, total: 20 }, t)]).seats[0];
    const lead = [c('A', 'BJP', 6000, 'LEADING'), c('B', 'JMM', 5000)];
    expect(at(trail([['BJP', 3000, 9000], ['BJP', 2000, 12000], ['BJP', 1000, 15000]]), lead).momentum).toBe('narrowing');
    expect(at(trail([['BJP', 500, 9000], ['BJP', 900, 12000], ['BJP', 1000, 15000]]), lead).momentum).toBe('widening');
    expect(at(trail([['JMM', 300, 9000], ['BJP', 600, 12000], ['BJP', 1000, 15000]], 1), lead)).toMatchObject({ momentum: 'switched', lead_changes: 1 });
    expect(at(trail([['JMM', 1200, 10000], ['BJP', 1000, 15000]], 1), lead).comeback).toBe(true);   // trailed by 12% of counted
    expect(analyseLive(base(), [live(lead, null, null)]).seats[0].momentum).toBeNull();
  });
  it('a seat missing from the baseline is still analysed without history', () => {
    const s = analyseLive(base(), [{ const_id: 'NOPE', candidates: [c('X', 'P', 10, 'LEADING'), c('Y', 'Q', 5)], round: null, trail: null }]).seats[0];
    expect(s).toMatchObject({ const_id: 'NOPE', outcome: { kind: 'new' }, call: 'counting', sitting: null });
  });
  it('live on final results equals analyse() (outcome, swing, held/gained/lost, flow)', () => {
    const cur = el(2024, [seat(1, [['B', 'JMM', 60], ['A', 'BJP', 40]])]);
    const inp = input(cur, [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])]), prev], { lineage: [JVM_MERGER] });
    const fin = analyse(inp);
    const l = analyseLive(baselineOf(inp), [{ const_id: 'T_1', candidates: cur.seats[0].candidates, round: null, trail: null }]);
    expect(l.seats[0].outcome).toEqual(fin.seats[0].outcome);
    expect(l.seats[0].swing).toEqual(fin.seats[0].swing);
    expect(l.tally.flow).toEqual(fin.election.flow);
    const pick = (p: { party_id: string; held: number; gained: number; lost: number }) => [p.party_id, p.held, p.gained, p.lost];
    expect(l.tally.parties.filter(p => p.won).map(pick)).toEqual(fin.election.parties.filter(p => p.won).map(pick));
  });
});

describe('analyseLive edge cases found by live = final', () => {
  it('a winner declared unopposed (WON, 0 votes) is the leader, declared, with the final outcome', () => {
    const cur = el(2024, [seat(1, [['A', 'BJP', 0, 'WON']])]);
    const inp = input(cur, [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])]), prev], { lineage: [JVM_MERGER] });
    const l = analyseLive(baselineOf(inp), [{ const_id: 'T_1', candidates: cur.seats[0].candidates, round: null, trail: null }]).seats[0];
    expect(l).toMatchObject({ call: 'declared', leader: { name: 'A' }, outcome: analyse(inp).seats[0].outcome });
  });
});

describe('review fixes', () => {
  it('no alliance moves when the previous election had no alliances (as analyse(): alliance change is null)', () => {
    const cur = el(2024, [seat(1, [['B', 'JMM', 60], ['A', 'BJP', 40]])], { alliances: [{ id: 'INDIA', parties: ['JMM'] }, { id: 'NDA', parties: ['BJP'] }] });
    const inp = input(cur, [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])]), prev], { lineage: [JVM_MERGER] });
    expect(analyse(inp).election.alliance).toBeNull();
    expect(analyseLive(baselineOf(inp), [{ const_id: 'T_1', candidates: cur.seats[0].candidates, round: null, trail: null }]).tally.alliance_moves).toEqual([]);
  });
  it('an estimate that runs out before the seat is declared never calls a narrow lead safe', () => {
    const cands = [c('A', 'BJP', 5050, 'LEADING'), c('B', 'JMM', 5000)];
    // all rounds in, not declared
    expect(analyseLive(base(), [live(cands, { current: 20, total: 20 })]).seats[0].call).toBe('counting');
    // electors fallback: turnout already above last time's (remaining clamps to 0)
    const b2 = base(el(2024, [seat(1, [['A', 'BJP', 0, 'PENDING'], ['B', 'JMM', 0, 'PENDING']], { electors: 10000 })]));
    expect(b2.seats[0].prev?.turnout ?? null).toBeNull();
    const withTurnout = { ...b2, seats: [{ ...b2.seats[0], prev: { ...b2.seats[0].prev!, turnout: 60 } }] };
    expect(analyseLive(withTurnout, [live(cands)]).seats[0].call).toBe('counting');
  });
  it('comeback uses the whole-timeline deficit (md) when the snapshot has it', () => {
    const lead = [c('A', 'BJP', 6000, 'LEADING'), c('B', 'JMM', 5000)];
    const t = { points: [{ r: 7, lp: 'BJP', m: 900, v: 15000 }, { r: 8, lp: 'BJP', m: 1000, v: 16000 }], lc: 1, pk: 1000, md: 0.2 };
    expect(analyseLive(base(), [live(lead, { current: 8, total: 20 }, t)]).seats[0].comeback).toBe(true);
    expect(analyseLive(base(), [live(lead, { current: 8, total: 20 }, { ...t, md: null })]).seats[0].comeback).toBe(false);
  });
});

