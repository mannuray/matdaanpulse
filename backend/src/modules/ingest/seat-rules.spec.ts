// backend/src/modules/ingest/seat-rules.spec.ts
import { checkRoster, deriveRows, evaluateSeat, holdDecision, isStale, sameAsStored, type IncomingSeat, type RosterCandidate, type StoredSeat } from './seat-rules';

const roster: RosterCandidate[] = [
  { candidate_id: 'a', party_id: 'BJP' }, { candidate_id: 'b', party_id: 'INC' },
  { candidate_id: 'c', party_id: 'IND' }, { candidate_id: 'n', party_id: 'NOTA' },
];
const seat = (over: Partial<IncomingSeat> = {}): IncomingSeat => ({
  const_id: 'S1', state: 'counting', round: { current: 5, total: 20 }, votes: { a: 500, b: 400, c: 100, n: 900 }, ...over,
});
const stored = (over: Partial<StoredSeat> = {}): StoredSeat => ({ state: 'counting', round_current: 4, round_total: 20, last_source: 'eci-web', last_observed_at: new Date('2027-02-27T09:00:00Z'), ...over });
const t = (s: string) => new Date(`2027-02-27T${s}Z`);

describe('checkRoster', () => {
  it('accepts exactly the roster', () => expect(checkRoster(seat(), roster)).toBeNull());
  it('rejects a missing or an unknown candidate, listing them', () => {
    expect(checkRoster(seat({ votes: { a: 1, b: 1, n: 1 } }), roster)).toEqual({ reason: 'roster_mismatch', detail: { missing: ['c'], unknown: [] } });
    expect(checkRoster(seat({ votes: { a: 1, b: 1, c: 1, n: 1, z: 1 } }), roster)).toEqual({ reason: 'roster_mismatch', detail: { missing: [], unknown: ['z'] } });
  });
  it('rejects negative or fractional votes and a round past its total', () => {
    expect(checkRoster(seat({ votes: { a: -1, b: 1, c: 1, n: 1 } }), roster)?.reason).toBe('invalid_votes');
    expect(checkRoster(seat({ votes: { a: 1.5, b: 1, c: 1, n: 1 } }), roster)?.reason).toBe('invalid_votes');
    expect(checkRoster(seat({ round: { current: 21, total: 20 } }), roster)?.reason).toBe('invalid_round');
  });
});

describe('deriveRows', () => {
  it('counting: top non-NOTA leads (NOTA never leads even with most votes); margin = top − second', () => {
    expect(deriveRows(seat(), roster)).toEqual([
      { candidate_id: 'a', votes: 500, status: 'LEADING', margin: 100 },
      { candidate_id: 'b', votes: 400, status: 'TRAILING', margin: 100 },
      { candidate_id: 'c', votes: 100, status: 'TRAILING', margin: 100 },
      { candidate_id: 'n', votes: 900, status: 'TRAILING', margin: 100 },
    ]);
  });
  it('declared: WON / LOST', () => {
    const rows = deriveRows(seat({ state: 'declared' }), roster) as any[];
    expect(rows.map(r => r.status)).toEqual(['WON', 'LOST', 'LOST', 'LOST']);
  });
  it('a tie at the top or all zero while counting: no leader', () => {
    expect((deriveRows(seat({ votes: { a: 5, b: 5, c: 1, n: 0 } }), roster) as any[]).every(r => r.status === 'TRAILING')).toBe(true);
    expect((deriveRows(seat({ votes: { a: 0, b: 0, c: 0, n: 0 } }), roster) as any[]).every(r => r.status === 'TRAILING')).toBe(true);
  });
  it('a declared tie is refused', () => expect(deriveRows(seat({ state: 'declared', votes: { a: 5, b: 5, c: 1, n: 0 } }), roster)).toEqual({ reason: 'declared_tie' }));
  it('countermanded / adjourned / not_started: no leader', () => {
    for (const state of ['countermanded', 'adjourned', 'not_started'] as const)
      expect((deriveRows(seat({ state }), roster) as any[]).every(r => r.status === 'TRAILING')).toBe(true);
  });
});

describe('isStale', () => {
  it('a lower round is stale; a higher one is not', () => {
    expect(isStale(seat({ round: { current: 3, total: 20 } }), stored(), 'eci-web', t('09:05:00'))).toBe(true);
    expect(isStale(seat(), stored(), 'eci-web', t('08:00:00'))).toBe(false);
  });
  it('same round: an older observation from the same source is stale; another source compares on round only', () => {
    const s = stored({ round_current: 5 });
    expect(isStale(seat(), s, 'eci-web', t('08:59:00'))).toBe(true);
    expect(isStale(seat(), s, 'eci-web', t('09:01:00'))).toBe(false);
    expect(isStale(seat(), s, 'news-feed', t('08:00:00'))).toBe(false);
  });
  it('after declared, only declared is accepted', () => {
    expect(isStale(seat({ state: 'counting', round: { current: 20, total: 20 } }), stored({ state: 'declared', round_current: 20 }), 'eci-web', t('10:00:00'))).toBe(true);
    expect(isStale(seat({ state: 'declared', round: { current: 20, total: 20 } }), stored({ state: 'declared', round_current: 20 }), 'eci-web', t('10:00:00'))).toBe(false);
  });
  it('nothing stored: never stale', () => expect(isStale(seat(), null, 'eci-web', t('09:00:00'))).toBe(false));
});

describe('holdDecision', () => {
  const hold = { round_at_hold: 5, expires_at: t('09:10:00') };
  it('none without a hold; keep at the same round before expiry', () => {
    expect(holdDecision(seat(), null, t('09:00:00'))).toBe('none');
    expect(holdDecision(seat(), hold, t('09:00:00'))).toBe('keep');
  });
  it('release on a later round or once expired', () => {
    expect(holdDecision(seat({ round: { current: 6, total: 20 } }), hold, t('09:00:00'))).toBe('release');
    expect(holdDecision(seat(), hold, t('09:10:00'))).toBe('release');
  });
  it('a source without rounds only releases by the timer', () => {
    expect(holdDecision(seat({ round: null }), hold, t('09:00:00'))).toBe('keep');
  });
});

describe('evaluateSeat', () => {
  const base = { roster, storedRows: [], hold: null, source: 'eci-web', observedAt: t('09:05:00'), now: t('09:05:01') };
  it('applies a new seat', () => {
    expect(evaluateSeat({ ...base, seat: seat(), stored: null })).toMatchObject({ kind: 'applied', releaseHold: false });
  });
  it('is unchanged when votes, statuses, margin, state and round match what is stored', () => {
    const rows = deriveRows(seat(), roster) as any[];
    expect(evaluateSeat({ ...base, seat: seat(), stored: stored({ round_current: 5 }), storedRows: rows })).toEqual({ kind: 'unchanged', releaseHold: false });
  });
  it('reports held, and applies with releaseHold once the hold lets go', () => {
    expect(evaluateSeat({ ...base, seat: seat(), stored: stored(), hold: { round_at_hold: 5, expires_at: t('09:10:00') } })).toEqual({ kind: 'held' });
    expect(evaluateSeat({ ...base, seat: seat({ round: { current: 6, total: 20 } }), stored: stored(), hold: { round_at_hold: 5, expires_at: t('09:10:00') } })).toMatchObject({ kind: 'applied', releaseHold: true });
  });
  it('order: roster before staleness before hold', () => {
    expect(evaluateSeat({ ...base, seat: seat({ votes: { a: 1 }, round: { current: 1, total: 20 } }), stored: stored() })).toMatchObject({ kind: 'rejected', reason: 'roster_mismatch' });
    expect(evaluateSeat({ ...base, seat: seat({ round: { current: 1, total: 20 } }), stored: stored(), hold: { round_at_hold: 5, expires_at: t('09:10:00') } })).toEqual({ kind: 'stale' });
  });
  it('sameAsStored compares state and round too', () => {
    const rows = deriveRows(seat(), roster) as any[];
    expect(sameAsStored(rows, seat(), rows, stored({ round_current: 4 }))).toBe(false);
    expect(sameAsStored(rows, seat(), rows, stored({ round_current: 5 }))).toBe(true);
  });
});
