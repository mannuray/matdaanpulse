import { baselineOf } from './baseline';
import { analyse } from './index';
import { el, input, seat, JVM_MERGER, SHS_SPLIT } from './fixtures';

const zero = (no: number, names: [string, string][]) => seat(no, names.map(([n, p]) => [n, p, 0, 'PENDING']));

describe('baselineOf', () => {
  it('previous holder carried through lineage, class before, prev shares, before any votes', () => {
    const h = [el(2009, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40], ['C', 'Z', 10]])]), el(2014, [seat(1, [['A', 'JVM', 55], ['B', 'JMM', 45]])])];
    const b = baselineOf(input(el(2024, [zero(1, [['A', 'BJP'], ['B', 'JMM']])]), h, { lineage: [JVM_MERGER] }));
    expect(b.seats[0].prev).toMatchObject({ year: 2014, party_raw: 'JVM', holder: 'BJP', candidate: 'A', margin: 10, shares: { BJP: 55, JMM: 45 } });
    expect(b.seats[0].class_before).toEqual({ kind: 'loyal', holder: 'BJP', streak: 2, since: 2009, wins: 2, total: 2 });
    expect(b.seats[0].sitting).toMatchObject({ name: 'A', recontested: true, same_seat: true, party_now: 'BJP', switched: false });
    expect(b.seats[0].sitting).not.toHaveProperty('won');
    expect(b.seats[0].rematch).toEqual(['A', 'B']);
  });
  it('a redraw has no prev; switchers and heavyweights come from the candidate list', () => {
    const before = el(2014, [seat(9, [['Unique Person', 'PDP', 50], ['Z', 'Y', 40]])]);
    const b = baselineOf(input(el(2024, [zero(1, [['Unique Person', 'APNI'], ['Q', 'NC']])]), [], {
      previousAny: before, heavyweights: [{ person_id: null, name: 'Q', party_id: 'NC', reason: 'state_president' }] }));
    expect(b.seats[0].prev).toBeNull();
    expect(b.seats[0].switchers).toEqual([{ kind: 'switcher', name: 'Unique Person', from: 'PDP', to: 'APNI', year: 2014, match: 'name' }]);
    expect(b.seats[0].heavyweights).toEqual([{ kind: 'heavyweight', name: 'Q', party: 'NC', reasons: ['state_president'] }]);
  });
  it('close / narrowing last time; the sitting MLA following a split is not a switch', () => {
    const s = (m: number, p = 'SHS') => seat(1, [['A', p, 50 + m], ['B', 'INC', 50 - m]]);
    const b = baselineOf(input(el(2024, [zero(1, [['A', 'SHSUBT'], ['B', 'INC']])]), [el(2009, [s(10)]), el(2014, [s(5)]), el(2019, [s(1)])], { lineage: [SHS_SPLIT] }));
    expect([b.seats[0].close_last, b.seats[0].narrowing_last]).toEqual([true, true]);
    expect(b.seats[0].sitting).toMatchObject({ switched: false, followed_split: true });
  });
  it('class_before equals the previous election\'s own final class', () => {
    const s = (p: string) => seat(1, [['A', p, 50], ['B', 'Z', 40]]);
    const h = [el(2010, [s('X')]), el(2015, [s('X')]), el(2020, [s('Y')])];
    expect(baselineOf(input(el(2025, [zero(1, [['A', 'X'], ['B', 'Z']])]), h)).seats[0].class_before).toEqual(analyse(input(h[2], h.slice(0, 2))).seats[0].class);
  });
});
