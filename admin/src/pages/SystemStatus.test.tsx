// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, renderHook } from '@testing-library/react';
import { SystemStatusView } from './SystemStatus';
import { useSystemStatus } from '../hooks/useSystemStatus';
import type { SystemStatus } from '../services/status.service';

const fixture: SystemStatus = {
  generatedAt: '2026-09-30T10:00:00.000Z',
  process: { startedAt: '2026-09-30T08:00:00.000Z', uptimeSeconds: 7265, nodeVersion: 'v20.1.0', appVersion: '0.1.0', gitSha: 'abc123def456', memory: { rssMb: 210, heapUsedMb: 90 } },
  http: {
    total: 1234, byClass: { '2xx': 1100, '3xx': 4, '4xx': 120, '5xx': 10, other: 0 }, throttled429: 7, shieldRejected403: 3,
    last5m: { requests: 50, requestsPerMin: 10, errors5xx: 0, errors5xxPerMin: 0 },
    last60m: { requests: 600, requestsPerMin: 10, errors5xx: 3, errors5xxPerMin: 0.05 },
    slowestRoutes: [{ route: 'GET /api/v1/elections/:id/results', p95Ms: 842, samples: 40 }],
  },
  cache: { hits: 75, misses: 25, fallbacks: 2, hitRate: 0.75 },
  redis: { pubReady: true, subReady: false, publishes: 9, published: 8, publishErrors: 1 },
  live: { sseConnections: 3, eventsPublished: 8, overridesApplied: 12, overridesLast5m: 10, overridesPerMin: 2, lastOverrideAt: null },
  db: { ok: true, latencyMs: 4, pool: { connectionLimit: 5, poolTimeoutSeconds: null } },
};

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SystemStatusView', () => {
  it('renders every card from the fixture', () => {
    render(<SystemStatusView status={fixture} error={null} loading={false} onRefresh={() => {}} />);
    expect(screen.getByText('2h 1m')).toBeTruthy();
    expect(screen.getByText('0.1.0 (abc123def456)')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('GET /api/v1/elections/:id/results')).toBeTruthy();
    expect(screen.getByText('842 ms')).toBeTruthy();
    expect(screen.getByText('down')).toBeTruthy(); // subscriber
    expect(screen.getByText('none yet')).toBeTruthy();
    expect(screen.getByText('4 ms')).toBeTruthy();
    expect(screen.getByText(/Since restart/)).toBeTruthy();
    expect(screen.getByText('Origin shield 403')).toBeTruthy();
  });

  it('manual refresh calls onRefresh and errors show an alert', () => {
    const onRefresh = vi.fn();
    render(<SystemStatusView status={null} error="boom" loading={false} onRefresh={onRefresh} />);
    expect(screen.getByRole('alert').textContent).toContain('boom');
    fireEvent.click(screen.getByText('REFRESH'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('useSystemStatus', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('loads, polls every interval, and pauses while the tab is hidden', async () => {
    const fetcher = vi.fn().mockResolvedValue(fixture);
    const { result } = renderHook(() => useSystemStatus(fetcher, 10_000));
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.status).toEqual(fixture);

    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    act(() => setHidden(true));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => setHidden(false)); // refreshes immediately on return
    expect(fetcher).toHaveBeenCalledTimes(3);
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(fetcher).toHaveBeenCalledTimes(4);

    await act(async () => { await result.current.refresh(); });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('surfaces a failed load as an error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useSystemStatus(fetcher, 10_000));
    await act(async () => {});
    expect(result.current.error).toBe('nope');
  });
});
