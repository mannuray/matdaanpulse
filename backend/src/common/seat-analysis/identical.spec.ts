import * as fs from 'fs';
import * as path from 'path';

// The shared seat-analysis module is byte-identical in backend and frontend (only lineage.ts differs per side).
const SHARED = ['types', 'rank', 'match', 'seat', 'notes', 'election', 'index'];
describe('seat-analysis stays identical to the frontend copy', () => {
  it.each(SHARED)('%s.ts', f => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    expect(read(`${f}.ts`)).toBe(read(`../../../../frontend/src/model/derive/seatAnalysis/${f}.ts`));
  });
});
