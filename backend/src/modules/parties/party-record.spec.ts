import { buildPartyRecord, familyIds, stateExtras, type LineageRow, type LoadedElection } from './party-record';

const ev = (party_id: string, predecessor_id: string, kind = 'merger', date = '2020-02-17', state_id: number | null = 9): LineageRow =>
  ({ party_id, predecessor_id, kind, effective_date: date, state_id, is_successor: true, note: null, source_url: null });
const row = (party_id: string, won: number, share = 10, contested = 50) =>
  ({ party_id, contested, won, votes: share * 1000, share, prev: null, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0 });
const el = (id: string, year: number, parties: any[], extra: Partial<LoadedElection> = {}): LoadedElection => ({
  id, state_id: 9, state_code: 'JH', state_name: 'Jharkhand', year, date: `${year}-12-01`, delimitation: '2008',
  seats_total: 81, government: ['BJP'], analysis: { parties, flow: [], breakdowns: { region: [] } } as any, ...extra,
});

describe('buildPartyRecord', () => {
  it('one row per election the party contested, newest first; largest and formed_government', () => {
    const r = buildPartyRecord('BJP', [el('e14', 2014, [row('BJP', 37), row('JMM', 19)]), el('e19', 2019, [row('BJP', 25), row('JMM', 30)], { government: ['JMM'] })], []);
    expect(r.elections.map(e => e.election_id)).toEqual(['e19', 'e14']);
    expect(r.elections[0]).toMatchObject({ won: 25, largest: false, formed_government: false, seats_total: 81 });
    expect(r.elections[1]).toMatchObject({ won: 37, largest: true, formed_government: true });
  });
  it('skips elections where the party did not contest or analysis is missing; government null without a record', () => {
    const r = buildPartyRecord('BJP', [el('a', 2009, [row('JMM', 18)]), el('b', 2014, [row('BJP', 37)], { government: null }), { ...el('c', 2019, []), analysis: null }], []);
    expect(r.elections.map(e => e.election_id)).toEqual(['b']);
    expect(r.elections[0].formed_government).toBeNull();
  });
  it('family rows: lineage members present in the same election', () => {
    const r = buildPartyRecord('BJP', [el('e14', 2014, [row('BJP', 37), row('JVM', 8), row('JMM', 19)])], [ev('BJP', 'JVM')]);
    expect(r.elections[0].family).toEqual([{ party_id: 'JVM', won: 8, share: 10 }]);
    expect(r.lineage).toHaveLength(1);
  });
  it('a party with 0 seats is never "largest"', () => {
    const r = buildPartyRecord('X', [el('a', 2014, [row('X', 0), row('Y', 0)])], []);
    expect(r.elections[0].largest).toBe(false);
  });
});

describe('buildPartyRecord family-only elections', () => {
  it('elections in its states where only a lineage relative ran (a successor\'s predecessor) are kept for comparisons', () => {
    const lineage = [ev('LJPRV', 'LJP', 'split', '2021-06-14', null)];
    const r = buildPartyRecord('LJPRV', [el('b20', 2020, [row('LJP', 1, 5.7), row('JDU', 43)]), el('b25', 2025, [row('LJPRV', 19, 5.0)]), el('x', 2015, [row('JDU', 71)])], lineage);
    expect(r.elections.map(e => e.election_id)).toEqual(['b25']);
    expect(r.family_elections).toEqual([{ election_id: 'b20', state_id: 9, year: 2020, date: '2020-12-01', delimitation: '2008', family: [{ party_id: 'LJP', won: 1, share: 5.7 }] }]);
  });
});

describe('buildPartyRecord state elections', () => {
  it('lists every election held in the party\'s states (newest first), contested or not', () => {
    const r = buildPartyRecord('AAP', [el('g22', 2022, [row('AAP', 2)]), el('g17', 2017, [row('BJP', 13)]), el('g12', 2012, [row('AAP', 0)]), { ...el('x', 2020, [row('BJP', 1)]), state_id: 3 }], []);
    expect(r.state_elections.map(e => e.election_id)).toEqual(['g22', 'g17', 'g12']);
    expect(r.state_elections[1]).toEqual({ election_id: 'g17', state_id: 9, year: 2017, date: '2017-12-01', delimitation: '2008' });
  });
});

describe('familyIds', () => {
  it('follows predecessors and successors transitively', () => {
    expect([...familyIds('BJP', [ev('BJP', 'JVM'), ev('JVM', 'JVMX', 'rename', '2006-01-01'), ev('OTHER', 'ZZ')])].sort()).toEqual(['BJP', 'JVM', 'JVMX']);
  });
});

describe('stateExtras', () => {
  it('keeps flow rows that touch the party; regions sorted by won, null when there are none', () => {
    const e = el('a', 2024, [row('BJP', 21)], {
      analysis: { parties: [row('BJP', 21)], flow: [{ from: 'JMM', to: 'BJP', seats: 4, split: false }, { from: 'INC', to: 'JMM', seats: 2, split: false }],
        breakdowns: { region: [{ group: 'Kolhan', seats: 14, parties: [{ party_id: 'BJP', won: 3, share: 30 }] }, { group: 'Palamu', seats: 9, parties: [{ party_id: 'BJP', won: 5, share: 40 }] }] } } as any,
    });
    const x = stateExtras('BJP', e);
    expect(x.flow).toEqual([{ from: 'JMM', to: 'BJP', seats: 4, split: false }]);
    expect(x.regions).toEqual([{ region: 'Palamu', seats: 9, won: 5 }, { region: 'Kolhan', seats: 14, won: 3 }]);
    expect(stateExtras('BJP', el('b', 2019, [row('BJP', 1)])).regions).toBeNull();
  });
  it('flow leaves out held seats (from = to); region names come from the lookup (the analysis stores region ids)', () => {
    const e = el('a', 2024, [row('BJP', 21)], {
      analysis: { parties: [row('BJP', 21)], flow: [{ from: 'BJP', to: 'BJP', seats: 11, split: false }, { from: 'BJP', to: 'JMM', seats: 6, split: false }],
        breakdowns: { region: [{ group: '3961', seats: 25, parties: [{ party_id: 'BJP', won: 12, share: 40 }] }] } } as any,
    });
    const x = stateExtras('BJP', e, id => ({ '3961': 'North Chotanagpur' } as Record<string, string>)[id] ?? id);
    expect(x.flow).toEqual([{ from: 'BJP', to: 'JMM', seats: 6, split: false }]);
    expect(x.regions).toEqual([{ region: 'North Chotanagpur', seats: 25, won: 12 }]);
  });
});
