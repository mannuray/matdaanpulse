import { leaderRow, writeSeats } from './seat-writer';

describe('leaderRow (the Live Console event for a seat)', () => {
  const party = new Map([['a', 'BJP'], ['b', 'INC'], ['n', 'NOTA']]);
  it('the LEADING / WON row, else the top non-NOTA row by votes', () => {
    expect(leaderRow([{ candidate_id: 'a', votes: 10, status: 'TRAILING', margin: 0 }, { candidate_id: 'b', votes: 5, status: 'LEADING', margin: 5 }], party)?.candidate_id).toBe('b');
    expect(leaderRow([{ candidate_id: 'n', votes: 99, status: 'TRAILING', margin: 0 }, { candidate_id: 'a', votes: 10, status: 'TRAILING', margin: 0 }], party)?.candidate_id).toBe('a');
    expect(leaderRow([{ candidate_id: 'n', votes: 1, status: 'TRAILING', margin: 0 }], party)).toBeNull();
  });
});

describe('writeSeats (the one results write, shared by ingest and the admin seat correction)', () => {
  function tx() {
    const sql: string[] = [];
    return { sql, $executeRaw: jest.fn(async (s: TemplateStringsArray) => { sql.push(s.join('?').replace(/\s+/g, ' ').trim().slice(0, 40)); return 1; }) };
  }
  it('applied seats: results, rounds, seat state, timeline; unchanged seats: seat state only', async () => {
    const t = tx();
    await writeSeats(t as any, 'e', {
      applied: [{ const_id: 'S1', state: 'counting', round: { current: 3, total: 20 }, rows: [{ candidate_id: 'a', votes: 10, status: 'LEADING', margin: 4 }] }],
      unchanged: [{ const_id: 'S2', state: 'counting', round: null }],
    }, 'eci-web', new Date(1), new Date(2), 'ingest');
    expect(t.sql.map(q => q.split(' ').slice(0, 2).join(' '))).toEqual(['UPDATE results', 'UPDATE constituencies', 'INSERT INTO', 'WITH ranked']);
  });
  it('nothing to write: no statements', async () => {
    const t = tx();
    await writeSeats(t as any, 'e', { applied: [], unchanged: [] }, 'admin', new Date(1), new Date(2), 'correction');
    expect(t.sql).toEqual([]);
  });
});
