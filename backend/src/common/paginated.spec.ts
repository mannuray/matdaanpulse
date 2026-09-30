import { Paginated, paginated } from './paginated';

describe('paginated()', () => {
  it('creates a Paginated marker carrying data and meta', () => {
    const p = paginated(['a'], { page: 1, limit: 10, total: 1 });
    expect(p).toBeInstanceOf(Paginated);
    expect(p.data).toEqual(['a']);
    expect(p.meta.total).toBe(1);
  });
});
