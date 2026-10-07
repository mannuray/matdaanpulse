   import { describe, it, expect } from 'vitest';
   import { baselineReady } from '../check';
   const r = (b: { computed_at: string | null; stale: boolean } | undefined) => ({ election: { id: 'e', type: 'VS', state_id: 1, year: 2027, status: 'Live' }, parties: [], seats: [], baseline: b }) as never;
   describe('baselineReady', () => {
     it('missing, stale, or an older server', () => {
       expect(baselineReady(r({ computed_at: null, stale: true }))).toMatch(/no baseline/);
       expect(baselineReady(r({ computed_at: '2027-02-26T10:00:00Z', stale: true }))).toMatch(/older than/);
       expect(baselineReady(r({ computed_at: '2027-02-26T10:00:00Z', stale: false }))).toBeNull();
       expect(baselineReady(r(undefined))).toMatch(/server/);
     });
   });
   