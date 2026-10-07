import { manifestBits, rolesAt } from './seat-analysis.loader';

describe('seat analysis loader helpers', () => {
  it('reads alliances, government, vote splits and leaders from manifest text; bad JSON = empty', () => {
    const m = manifestBits(JSON.stringify({ alliances: [{ id: 'NDA', parties: ['BJP'] }], government: { parties: ['BJP'], source: 'x' },
      vote_splits: [{ spoiler: 'BSP', hurts: 'MGB' }], leaders: [{ name: 'L', party_id: 'BJP' }], cabinet: [{ name: 'C', party_id: 'BJP', person_id: 'p9' }] }));
    expect(m.alliances).toEqual([{ id: 'NDA', parties: ['BJP'] }]);
    expect(m.government).toEqual(['BJP']);
    expect(m.voteSplits).toEqual([{ spoiler: 'BSP', hurts: 'MGB' }]);
    expect(m.heavyweights).toEqual([{ person_id: null, name: 'L', party_id: 'BJP', reason: 'leader' }, { person_id: 'p9', name: 'C', party_id: 'BJP', reason: 'cabinet' }]);
    expect(manifestBits('{oops')).toEqual({ alliances: [], government: null, voteSplits: [], heavyweights: [] });
    expect(manifestBits(null).government).toBeNull();
  });
  it('keeps unit roles active on the election date', () => {
    const d = (s: string | null) => (s ? new Date(s) : null);
    const roles = [
      { party_id: 'BJP', role: 'state_president', person_id: 'a', person_name: 'A', from_date: d('2019-01-01'), to_date: d('2021-01-01') },
      { party_id: 'BJP', role: 'state_president', person_id: 'b', person_name: 'B', from_date: d('2021-01-02'), to_date: null },
      { party_id: 'INC', role: 'legislature_leader', person_id: null, person_name: 'C', from_date: null, to_date: null },
    ];
    expect(rolesAt(roles, '2020-11-10').map(r => r.name)).toEqual(['A', 'C']);
  });
});
