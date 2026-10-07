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

describe('seat analysis: notes', () => {
  const kinds = (s: ReturnType<typeof one>) => s.notes.map(n => n.kind);
  it('generic spoiler: third candidate above the margin; NOTA above the margin', () => {
    const s = one(input(el(2020, [seat(1, [['A', 'X', 40], ['B', 'Y', 35], ['C', 'Z', 10], ['NOTA', 'NOTA', 8]])])));
    expect(s.notes).toEqual([{ kind: 'spoiler', name: 'C', party: 'Z', votes: 10, margin: 5 }, { kind: 'nota', votes: 8, margin: 5 }]);
  });
  it('alliance spoiler replaces the generic one', () => {
    const cur = el(2025, [seat(1, [['A', 'BJP', 40], ['B', 'RJD', 35], ['C', 'AIMIM', 10]])], { alliances: [{ id: 'MGB', parties: ['RJD', 'INC'] }, { id: 'NDA', parties: ['BJP'] }] });
    const s = one(input(cur, [], { voteSplits: [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }] }));
    expect(s.notes.filter(n => n.kind === 'spoiler')).toEqual([{ kind: 'spoiler', name: 'C', party: 'AIMIM', votes: 10, margin: 5, hurts: 'MGB', label: 'AIMIM split' }]);
  });
  it('rematch and revenge', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]])]);
    const s = one(input(el(2020, [seat(1, [['B', 'Y', 50], ['A', 'X', 45]])]), [prev]));
    expect(s.notes).toEqual(expect.arrayContaining([{ kind: 'rematch', names: ['B', 'A'] }, { kind: 'revenge', name: 'B', beat: 'A' }]));
  });
  it('switcher: a top-two candidate whose last candidacy was for a non-comparable party (a split faction is not one)', () => {
    const prev = el(2019, [seat(1, [['A', 'INC', 50], ['B', 'SHS', 40]]), seat(2, [['Q', 'Y', 9]])]);
    const cur = el(2024, [seat(1, [['A', 'BJP', 50], ['B', 'SHSUBT', 40]])]);
    const s = one(input(cur, [prev], { lineage: [SHS_SPLIT] }));
    expect(s.notes.filter(n => n.kind === 'switcher')).toEqual([{ kind: 'switcher', name: 'A', from: 'INC', to: 'BJP', year: 2019, match: 'name' }]);
  });
  it('switcher looks across a redraw via previousAny', () => {
    const before = el(2014, [seat(9, [['Unique Person', 'PDP', 50], ['Z', 'Y', 40]])]);
    const s = one(input(el(2024, [seat(1, [['Unique Person', 'APNI', 50], ['B', 'NC', 40]])]), [], { previousAny: before }));
    expect(s.notes).toContainEqual({ kind: 'switcher', name: 'Unique Person', from: 'PDP', to: 'APNI', year: 2014, match: 'name' });
  });
  it('heavyweight needs the same person and the same party', () => {
    const cur = el(2020, [seat(1, [['Ram Kumar', 'BJP', 50], ['Ram Kumar', 'INC', 40]])]);
    const s = one(input(cur, [], { heavyweights: [{ person_id: null, name: 'Ram Kumar', party_id: 'BJP', reason: 'state_president' }, { person_id: null, name: 'Ram Kumar', party_id: 'BJP', reason: 'leader' }] }));
    expect(s.notes.filter(n => n.kind === 'heavyweight')).toEqual([{ kind: 'heavyweight', name: 'Ram Kumar', party: 'BJP', reasons: ['state_president', 'leader'] }]);
    expect(kinds(s)).not.toContain('switcher');
  });
});

describe('election analysis', () => {
  const e = (inp: Parameters<typeof analyse>[0]) => analyse(inp).election;
  it('party rows: contested, won, share; held/gained/lost; prev across a redraw via previousAny', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 60], ['B', 'Y', 40]]), seat(2, [['C', 'X', 60], ['D', 'Y', 40]])]);
    const cur = el(2020, [seat(1, [['A', 'X', 55], ['B', 'Y', 45]]), seat(2, [['D', 'Y', 70], ['C', 'X', 30]])]);
    const x = e(input(cur, [prev])).parties.find(p => p.party_id === 'X')!;
    expect(x).toEqual({ party_id: 'X', contested: 2, won: 1, votes: 85, share: 42.5, prev: { won: 2, share: 60 }, held: 1, gained: 0, lost: 1, split_gained: 0, split_lost: 0 });
    const redraw = e(input(cur, [], { previousAny: prev }));
    expect(redraw.parties.find(p => p.party_id === 'X')).toMatchObject({ prev: { won: 2, share: 60 }, held: 0, lost: 0 });
    expect(redraw.flow).toEqual([]);
    expect(redraw.prev_election_id).toBeNull();
    expect(redraw.prev_any_election_id).toBe('E2015');
  });
  it('flow carries the old holder; split moves are flagged; family totals', () => {
    const prev = el(2019, [seat(1, [['A', 'SHS', 50], ['B', 'INC', 40]]), seat(2, [['C', 'JVM', 50], ['D', 'INC', 40]])]);
    const cur = el(2024, [seat(1, [['E', 'SHSUBT', 50], ['A', 'SHS', 40]]), seat(2, [['C', 'BJP', 50], ['D', 'INC', 40]])]);
    const r = e(input(cur, [prev], { lineage: [SHS_SPLIT, { ...JVM_MERGER, effective_date: '2020-02-17' }] }));
    expect(r.flow).toEqual(expect.arrayContaining([{ from: 'SHS', to: 'SHSUBT', seats: 1, split: true }, { from: 'BJP', to: 'BJP', seats: 1, split: false }]));
    expect(r.families).toEqual([{ root: 'SHS', members: ['SHS', 'SHSUBT'], won: 1, share: 50 }]);
  });
  it('alliance change: moves between alliances, moves inside one, UPA = INDIA, shares', () => {
    const prev = el(2019, [seat(1, [['A', 'INC', 50], ['B', 'BJP', 40]]), seat(2, [['C', 'JDU', 50], ['D', 'INC', 40]])], { alliances: [{ id: 'UPA', parties: ['INC'] }, { id: 'NDA', parties: ['BJP', 'JDU'] }] });
    const cur = el(2024, [seat(1, [['B', 'BJP', 50], ['A', 'INC', 40]]), seat(2, [['E', 'BJP', 50], ['D', 'INC', 40]])], { alliances: [{ id: 'INDIA', parties: ['INC'] }, { id: 'NDA', parties: ['BJP', 'JDU'] }] });
    const a = e(input(cur, [prev])).alliance!;
    expect(a.moves).toEqual([{ from: 'INDIA', to: 'NDA', seats: 1 }]);
    expect(a.within).toEqual([{ alliance: 'NDA', seats: 1 }]);
    expect(a.shares.find(s => s.alliance === 'NDA')).toEqual({ alliance: 'NDA', share: 55.6, prev_share: 50 });
  });
  it('close and narrowing seats', () => {
    const s = (m: number) => seat(1, [['A', 'X', 50 + m], ['B', 'Y', 50 - m]]);
    const r = e(input(el(2020, [s(1)]), [el(2010, [s(10)]), el(2015, [s(5)])]));
    expect(r.close_seats).toEqual(['T_1']);
    expect(r.narrowing_seats).toEqual(['T_1']);
  });
  it('bellwether: winner in government every time, 3+ elections, all known; a missing government gives none', () => {
    const s = (p: string) => seat(1, [['A', p, 50], ['B', 'Z', 40]]);
    const h = [el(2010, [s('X')], { government: ['X'] }), el(2015, [s('Y')], { government: ['Y', 'W'] })];
    const r = analyse(input(el(2020, [s('X')], { government: ['X'] }), h));
    expect(r.election.bellwethers).toEqual(['T_1']);
    expect(r.seats[0].notes).toContainEqual({ kind: 'bellwether', elections: 3 });
    expect(e(input(el(2020, [s('X')]), h)).bellwethers).toEqual([]);
  });
  it('breakdowns: reserved, region, turnout band', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]], { turnout: 60 })]);
    const cur = el(2020, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]], { turnout: 67, reserved: 'SC', region_id: 7 })]);
    const b = e(input(cur, [prev])).breakdowns;
    expect(b.reserved).toEqual([{ group: 'SC', seats: 1, parties: [{ party_id: 'X', won: 1, share: 55.6 }, { party_id: 'Y', won: 0, share: 44.4 }] }]);
    expect(b.region.map(g => g.group)).toEqual(['7']);
    expect(b.turnout.map(g => g.group)).toEqual(['≥5']);
  });
});

describe('phase B fixes', () => {
  it('incumbent.won is null while the seat they contest has no winner', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]])]);
    const inc = one(input(el(2020, [seat(1, [['A', 'X', 0, 'TRAILING'], ['C', 'Y', 0, 'TRAILING']])]), [prev])).incumbent;
    expect(inc).toMatchObject({ recontested: true, won: null });
  });
  it('a heavyweight never matches a namesake with a different person_id', () => {
    const cur = el(2020, [seat(1, [['Ram Kumar', 'BJP', 50, undefined, 'p2'], ['Z', 'INC', 40]])]);
    const s = one(input(cur, [], { heavyweights: [{ person_id: 'p1', name: 'Ram Kumar', party_id: 'BJP', reason: 'leader' }] }));
    expect(s.notes.filter(n => n.kind === 'heavyweight')).toEqual([]);
  });
});
