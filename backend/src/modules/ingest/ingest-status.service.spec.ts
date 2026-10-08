import { alertsFor, IngestStatusService, type ShardStatus } from './ingest-status.service';

const NOW = new Date('2027-02-27T04:30:00Z');
const shard = (over: Partial<ShardStatus> = {}): ShardStatus => ({
  name: 'rest', seat_count: 126, source: 'eci-web', lease_holder: 'w1', lease_expires_at: new Date(NOW.getTime() + 60_000),
  last_post_at: NOW, last_applied_at: NOW, lag_s: 40, recent: {}, rejected: [], refused: {}, tally_mismatch: null, takeover: null, ...over,
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

describe('alertsFor — refused requests', () => {
  it('refused requests in the last 5 minutes alert with their reasons and counts', () => {
    const out = alertsFor(shard({ refused: { no_lease: 3, inactive_source: 1 } }), 'e', true, NOW, false);
    expect(out.map(a => [a.key, a.message])).toEqual([['e:rest:refused', 'Shard rest refused: inactive_source ×1, no_lease ×3 in last 5 min']]);
  });
});

describe('alertsFor — lease takeover', () => {
  it('a lease that changed hands in the last 10 minutes is a warn alert naming both holders, keyed per takeover', () => {
    const at = new Date(NOW.getTime() - 120_000);
    const out = alertsFor(shard({ takeover: { from: 'cloud-1', to: 'laptop', at, after: 'expiry' } }), 'e', true, NOW, false);
    expect(out).toEqual([{ key: `e:rest:takeover:${at.toISOString()}`, level: 'warn', election_id: 'e', shard: 'rest',
      message: 'Shard rest changed hands: cloud-1 → laptop (after the lease expired)' }]);
    const rel = alertsFor(shard({ takeover: { from: 'cloud-1', to: 'laptop', at, after: 'release' } }), 'e', true, NOW, false);
    expect(rel[0].message).toBe('Shard rest changed hands: cloud-1 → laptop (after a release)');
  });
});

describe('IngestStatusService.status', () => {
  const make = (logs: { posts?: any[]; refused?: any[]; rejected?: any[]; takeovers?: any[] }) => {
    const prisma: any = {
      elections: { findUnique: jest.fn(async () => ({ status: 'Live' })) },
      election_ingest: { findUnique: jest.fn(async () => ({ active_source: 'eci-web', hold_minutes: 10, updated_at: new Date(NOW.getTime() - 600_000) })) },
      ingest_log: {
        findMany: jest.fn(async ({ where }) => (where.kind === 'seats' ? logs.posts ?? [] : [])),
        groupBy: jest.fn(async () => logs.refused ?? []),
      },
      seat_ingest_state: { aggregate: jest.fn(async () => ({ _max: { last_applied_at: null } })), findMany: jest.fn(async () => logs.rejected ?? []) },
      audit_logs: { findMany: jest.fn(async () => logs.takeovers ?? []) },
    };
    const shards: any = { list: jest.fn(async () => [{ name: 'rest', seat_ids: ['S1', 'S2'], source_override: null, lease_holder: 'w1', lease_expires_at: new Date(NOW.getTime() + 60_000) }]) };
    const ingest: any = { effectiveSource: jest.fn(async () => 'eci-web') };
    return { svc: new IngestStatusService(prisma, shards, ingest), prisma };
  };
  it('a Live shard with a source that never posted lags from the feed settings change, so the lag alert fires', async () => {
    const { svc } = make({});
    const out = await svc.status('e', NOW);
    expect(out.shards[0].lag_s).toBe(600);
    expect(out.alerts.map(a => a.key)).toEqual(['e:rest:lag']);
  });
  it('rejected seats come from seat_ingest_state (current rejections), refused counts from the last 5 minutes; refused rows are not posts', async () => {
    const { svc, prisma } = make({
      posts: [{ received_at: NOW, observed_at: NOW, counts: { applied: 2 }, rejected: [] }],
      refused: [{ refused: 'no_lease', _count: { _all: 4 } }],
      rejected: [{ const_id: 'S2', last_rejected_reason: 'roster_mismatch' }],
    });
    const out = await svc.status('e', NOW);
    expect(out.shards[0]).toMatchObject({ lag_s: 0, rejected: [{ const_id: 'S2', reason: 'roster_mismatch' }], refused: { no_lease: 4 } });
    expect(out.alerts.map(a => a.key)).toEqual(['e:rest:rejected', 'e:rest:refused']);
    expect(prisma.ingest_log.findMany.mock.calls[0][0].where).toMatchObject({ kind: 'seats', refused: null });
    expect(prisma.ingest_log.groupBy.mock.calls[0][0].where.received_at).toEqual({ gte: new Date(NOW.getTime() - 300_000) });
  });
  it('reads lease takeovers of the last 10 minutes from the audit log, the latest per shard', async () => {
    const { svc, prisma } = make({
      posts: [{ received_at: NOW, observed_at: NOW, counts: { applied: 2 }, rejected: [] }],
      takeovers: [
        { timestamp: new Date(NOW.getTime() - 60_000), old_value: { shard: 'rest', holder: 'laptop', expires_at: null }, new_value: { shard: 'rest', holder: 'cloud-2' } },
        { timestamp: new Date(NOW.getTime() - 300_000), old_value: { shard: 'rest', holder: 'cloud-1', expires_at: '2027-02-27T04:24:00Z' }, new_value: { shard: 'rest', holder: 'laptop' } },
      ],
    });
    const out = await svc.status('e', NOW);
    expect(out.shards[0].takeover).toEqual({ from: 'laptop', to: 'cloud-2', at: new Date(NOW.getTime() - 60_000), after: 'release' });
    expect(out.alerts.map(a => a.level)).toEqual(['warn']);
    expect(prisma.audit_logs.findMany.mock.calls[0][0]).toMatchObject({
      where: { action: 'INGEST_LEASE_TAKEOVER', entity_type: 'election', entity_id: 'e', timestamp: { gte: new Date(NOW.getTime() - 600_000) } },
      orderBy: { timestamp: 'desc' } });
  });
});
