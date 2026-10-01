import { describe, it, expect, vi, afterEach } from 'vitest';

const api = vi.hoisted(() => ({ apiFetch: vi.fn(async (_path: string) => [] as unknown[]) }));
vi.mock('./api-client', () => api);
import { getAuditLogs } from './audit.service';

afterEach(() => api.apiFetch.mockClear());
const query = () => new URL(`http://x${api.apiFetch.mock.calls[0][0]}`).searchParams;

describe('getAuditLogs (Review Focus 3)', () => {
  it('sends From and To as the start and end of the IST day, so the whole day is included', async () => {
    await getAuditLogs({ action: 'RESULT_OVERRIDE', entity_type: 'result', from: '2026-10-01', to: '2026-10-01' });
    expect(query().get('from')).toBe('2026-10-01T00:00:00.000+05:30');
    expect(query().get('to')).toBe('2026-10-01T23:59:59.999+05:30');
    expect(query().get('action')).toBe('RESULT_OVERRIDE');
    expect(query().get('entity_type')).toBe('result');
    // '+' must be percent-encoded, or the server would read a space.
    expect(api.apiFetch.mock.calls[0][0]).toContain('%2B05%3A30');
  });

  it('no filters → no query string; a value that is not a day is dropped', async () => {
    await getAuditLogs();
    expect(api.apiFetch).toHaveBeenLastCalledWith('/admin/audit-logs');
    api.apiFetch.mockClear();
    await getAuditLogs({ from: '01/10/2026', to: '' });
    expect(api.apiFetch).toHaveBeenLastCalledWith('/admin/audit-logs');
  });
});
