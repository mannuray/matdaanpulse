import { seatTally } from './tally';

describe('seatTally', () => {
  it('counts WON and LEADING per party; other statuses and rows without a party are left out', () => {
    const t = seatTally([
      { party_id: 'BJP', status: 'WON' },
      { party_id: 'BJP', status: 'LEADING' },
      { party_id: 'BJP', status: 'WON' },
      { party_id: 'INC', status: 'LEADING' },
      { party_id: 'INC', status: 'TRAILING' },
      { party_id: 'AAP', status: 'LOST' },
      { party_id: null, status: 'WON' },
    ]);
    expect([...t.entries()]).toEqual([
      ['BJP', { won: 2, leading: 1 }],
      ['INC', { won: 0, leading: 1 }],
    ]);
  });

  it('is empty for no rows', () => {
    expect(seatTally([]).size).toBe(0);
  });
});
