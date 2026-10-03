import { alertsFor, type ShardStatus } from './ingest-status.service';

const NOW = new Date('2027-02-27T04:30:00Z');
const shard = (over: Partial<ShardStatus> = {}): ShardStatus => ({
  name: 'rest', seat_count: 126, source: 'eci-web', lease_holder: 'w1', lease_expires_at: new Date(NOW.getTime() + 60_000),
  last_post_at: NOW, last_applied_at: NOW, lag_s: 40, recent: {}, rejected: [], tally_mismatch: null, ...over,
});

describe('alertsFor', () => {
  it('a healthy shard has no alerts; a not-Live election never alerts', () => {
    expect(alertsFor(shard(), 'e', true, NOW, false)).toEqual([]);
    expect(alertsFor(shard({ lag_s: 999 }), 'e', false, NOW, false)).toEqual([]);
  });
  it('lag over 3 minutes', () => expect(alertsFor(shard({ lag_s: 181 }), 'e', true, NOW, false).map(a => a.key)).toEqual(['e:rest:lag']));
  it('a lease lapsed for over 2 minutes, only when the shard has a source', () => {
    const lapsed = shard({ lease_expires_at: new Date(NOW.getTime() - 121_000) });
    expect(alertsFor(lapsed, 'e', true, NOW, false).map(a => a.key)).toEqual(['e:rest:lease']);
    expect(alertsFor({ ...lapsed, source: null }, 'e', true, NOW, false)).toEqual([]);
  });
  it('rejected seats, and a tally mismatch twice in a row', () => {
    expect(alertsFor(shard({ rejected: [{ const_id: 'S1', reason: 'roster_mismatch' }] }), 'e', true, NOW, false).map(a => a.key)).toEqual(['e:rest:rejected']);
    const mm = shard({ tally_mismatch: [{ party_id: 'BJP', ours: { won: 1, leading: 0 }, theirs: { won: 2, leading: 0 } }] });
    expect(alertsFor(mm, 'e', true, NOW, false)).toEqual([]);
    expect(alertsFor(mm, 'e', true, NOW, true).map(a => a.key)).toEqual(['e:rest:tally']);
  });
});
