import { analyse } from './index';
import { findPerson } from './match';
import { el, input, seat, JVM_MERGER, SHS_SPLIT } from './fixtures';

const one = (inp: Parameters<typeof analyse>[0]) => analyse(inp).seats[0];

describe('seat analysis: order and outcome', () => {
  it('throws when history is newest first', () => {
    const a = el(2010, [seat(1, [['A', 'X', 10]])]), b = el(2015, [seat(1, [['A', 'X', 10]])]);
    expect(() => analyse(input(el(2020, [seat(1, [['A', 'X', 10]])]), [b, a]))).toThrow(/oldest → newest/);
  });
  it('compares with the newest earlier election, not the oldest', () => {
    const h = [el(2010, [seat(1, [['P', 'RJD', 50], ['Q', 'JDU', 40]])]), el(2020, [seat(1, [['R', 'BJP', 50], ['S', 'RJD', 40]])])];
    const s = one(input(el(2025, [seat(1, [['R', 'BJP', 60], ['S', 'RJD', 30]])]), h));
    expect(s.outcome).toEqual({ kind: 'retained', from: 'BJP', from_raw: 'BJP' });
    expect(s.incumbent?.name).toBe('R');
  });
  it('gained / split / new', () => {
    const prev = el(2019, [seat(1, [['A', 'SHS', 50], ['B', 'INC', 40]]), seat(2, [['C', 'SHS', 50], ['D', 'INC', 40]])]);
    const cur = el(2024, [seat(1, [['E', 'SHSUBT', 50], ['A', 'SHS', 40]]), seat(2, [['D', 'INC', 50], ['C', 'SHS', 40]]), seat(3, [['F', 'BJP', 9]])]);
    const r = analyse(input(cur, [prev], { lineage: [SHS_SPLIT] })).seats;
    expect(r[0].outcome?.kind).toBe('split');
    expect(r[1].outcome).toEqual({ kind: 'gained', from: 'SHS', from_raw: 'SHS' });
    expect(r[2].outcome?.kind).toBe('new');
  });
  it('a merger carries the old holder (JVM 2014 → BJP 2024 is retained; history family = BJP)', () => {
    const s = one(input(el(2024, [seat(1, [['A', 'BJP', 50], ['B', 'JMM', 40]])]), [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])])], { lineage: [JVM_MERGER] }));
    expect(s.outcome).toEqual({ kind: 'retained', from: 'BJP', from_raw: 'JVM' });
    expect(s.history.map(h => [h.year, h.party, h.family])).toEqual([[2014, 'JVM', 'BJP'], [2024, 'BJP', 'BJP']]);
  });
  it('two different independents are a gain; the same independent is retained', () => {
    const prev = el(2015, [seat(1, [['Ram Lal', 'IND', 50], ['B', 'INC', 40]]), seat(2, [['Ram Lal', 'IND', 50], ['B', 'INC', 40]])]);
    const r = analyse(input(el(2020, [seat(1, [['Shyam', 'IND', 50], ['B', 'INC', 40]]), seat(2, [['RAM LAL', 'IND', 50], ['B', 'INC', 40]])]), [prev])).seats;
    expect(r[0].outcome?.kind).toBe('gained');
    expect(r[1].outcome?.kind).toBe('retained');
  });
  it('a seat with no WON/LEADING row has no winner, outcome or class (and does not crash)', () => {
    const s = one(input(el(2020, [seat(1, [['A', 'X', 10, 'TRAILING'], ['B', 'Y', 5, 'TRAILING']])]), [el(2015, [seat(1, [['A', 'X', 10]])])]));
    expect([s.winner, s.outcome, s.class, s.swing]).toEqual([null, null, null, null]);
  });
  it('NOTA is never runner-up but counts in the total', () => {
    const s = one(input(el(2020, [seat(1, [['A', 'X', 50], ['NOTA', 'NOTA', 45], ['B', 'Y', 5]])])));
    expect(s.runner_up?.name).toBe('B');
    expect(s.total_votes).toBe(100);
    expect(s.margin).toBe(45);
  });
  it('LEADING is provisional', () => {
    expect(one(input(el(2020, [seat(1, [['A', 'X', 50, 'LEADING'], ['B', 'Y', 40, 'TRAILING']])]))).provisional).toBe(true);
  });
});

describe('seat analysis: class', () => {
  const s = (p: string) => seat(1, [['A', p, 50], ['B', 'Z', 40]]);
  it('stronghold: same party every time, at least 3', () => {
    expect(one(input(el(2020, [s('X')]), [el(2010, [s('X')]), el(2015, [s('X')])])).class).toEqual({ kind: 'stronghold', holder: 'X', streak: 3, since: 2010, wins: 3, total: 3 });
  });
  it('loyal: streak 2 but not every time; and 2 of 2 is loyal, not stronghold', () => {
    expect(one(input(el(2020, [s('X')]), [el(2010, [s('Y')]), el(2015, [s('X')])])).class?.kind).toBe('loyal');
    expect(one(input(el(2020, [s('X')]), [el(2015, [s('X')])])).class?.kind).toBe('loyal');
  });
  it('swing: changed hands now (even after a long run of another party)', () => {
    expect(one(input(el(2020, [s('X')]), [el(2005, [s('Y')]), el(2010, [s('Y')]), el(2015, [s('Y')])])).class).toMatchObject({ kind: 'swing', holder: 'X', streak: 1, wins: 1, total: 4 });
  });
  it('new: no comparable history', () => {
    expect(one(input(el(2020, [s('X')]))).class?.kind).toBe('new');
  });
});

describe('seat analysis: swing, incumbency, seat type', () => {
  it('vote swing of the winner party and of the previous holder, through lineage', () => {
    const prev = el(2014, [seat(1, [['A', 'JVM', 40], ['B', 'JMM', 50], ['C', 'Z', 10]])]);
    const s = one(input(el(2024, [seat(1, [['A', 'BJP', 55], ['B', 'JMM', 45]])]), [prev], { lineage: [JVM_MERGER] }));
    expect(s.swing).toEqual({ winner_party: 15, prev_holder: -5 });
  });
  it('incumbent found by person_id in another seat, with a party switch', () => {
    const prev = el(2015, [seat(1, [['Old Name', 'RJD', 50, undefined, 'p1'], ['B', 'JDU', 40]])]);
    const cur = el(2020, [seat(1, [['C', 'RJD', 50], ['B', 'JDU', 40]]), seat(2, [['New Spelling', 'BJP', 60, undefined, 'p1'], ['D', 'INC', 30]])]);
    expect(one(input(cur, [prev])).incumbent).toEqual({
      name: 'Old Name', person_id: 'p1', party: 'RJD', match: 'person', recontested: true, const_id: 'T_2', same_seat: false,
      party_now: 'BJP', switched: true, followed_split: false, won: true,
    });
  });
  it('incumbent by name in the same seat; following a split faction is not a switch', () => {
    const prev = el(2019, [seat(1, [['Aaditya', 'SHS', 50], ['B', 'INC', 40]])]);
    const inc = one(input(el(2024, [seat(1, [['AADITYA', 'SHSUBT', 50], ['B', 'INC', 40]])]), [prev], { lineage: [SHS_SPLIT] })).incumbent;
    expect(inc).toMatchObject({ match: 'name', same_seat: true, switched: false, followed_split: true, won: true });
  });
  it('not re-contesting', () => {
    const inc = one(input(el(2020, [seat(1, [['C', 'X', 50], ['D', 'Y', 40]])]), [el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]])])])).incumbent;
    expect(inc).toMatchObject({ recontested: false, const_id: null, won: null });
  });
  it('a name found elsewhere counts only if unique in the election', () => {
    const e = el(2020, [seat(1, [['Q', 'X', 1]]), seat(2, [['Ram Kumar', 'X', 5]]), seat(3, [['Ram Kumar', 'Y', 5]]), seat(4, [['Sita Devi', 'Z', 5]])]);
    expect(findPerson({ person_id: null, name: 'Ram Kumar' }, e, 1)).toBeNull();
    expect(findPerson({ person_id: null, name: 'Sita Devi' }, e, 1)?.seat.const_no).toBe(4);
  });
  it('seat type', () => {
    const t = (c: Parameters<typeof seat>[1]) => one(input(el(2020, [seat(1, c)]))).seat_type;
    expect(t([['A', 'X', 50], ['B', 'Y', 45], ['C', 'Z', 5]])).toBe('two-way');
    expect(t([['A', 'X', 40], ['B', 'Y', 35], ['C', 'Z', 25]])).toBe('three-way');
    expect(t([['A', 'X', 40], ['B', 'Y', 35], ['C', 'Z', 12], ['D', 'W', 13]])).toBe('multi-cornered');
  });
});
