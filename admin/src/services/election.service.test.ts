import { describe, it, expect, vi, afterEach } from 'vitest';
const api = vi.hoisted(() => ({ apiFetch: vi.fn(async () => []) }));
vi.mock('./api-client', () => api);
import { getElections } from './election.service';

afterEach(() => vi.clearAllMocks());

describe('getElections', () => {
  it('reads the admin list (every election, with manifest_published), not the public one', async () => {
    await getElections();
    expect(api.apiFetch).toHaveBeenCalledWith('/admin/elections');
    await getElections({ type: 'VS', status: 'Live' });
    expect(api.apiFetch).toHaveBeenLastCalledWith('/admin/elections?type=VS&status=Live');
  });
});
