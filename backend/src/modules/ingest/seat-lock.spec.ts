import { lockSeats } from './seat-lock';

function tx() {
  const calls: { sql: string; vals: unknown[] }[] = [];
  return { calls, $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...vals: unknown[]) => { calls.push({ sql: strings.join('?'), vals }); return 1; }) };
}

describe('lockSeats', () => {
  it('takes every seat lock in one statement, deduplicated, in JS-sorted const_id order', async () => {
    const t = tx();
    await lockSeats(t as any, 'e', ['S10', 'S2', 'S1', 'S2']);
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0].sql).toContain('pg_advisory_xact_lock');
    expect(t.calls[0].sql).toMatch(/WITH ORDINALITY/);
    expect(t.calls[0].sql).toMatch(/ORDER BY/);
    expect(t.calls[0].vals).toEqual(['e', ['S1', 'S10', 'S2']]);
  });
  it('no seats: no statement', async () => {
    const t = tx();
    await lockSeats(t as any, 'e', []);
    expect(t.calls).toHaveLength(0);
  });
});
