import { rolesAt } from './seat-analysis.loader';

describe('seat analysis loader helpers', () => {
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
