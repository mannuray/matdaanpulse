import { describe, it, expect } from 'vitest';
import { retryDelay } from '../hooks/useSSE';

describe('SSE retry policy', () => {
  it('backs off exponentially, capped at 30s', () => {
    expect(retryDelay(0, 0)).toBe(1000);
    expect(retryDelay(3, 0)).toBe(8000);
    expect(retryDelay(7, 0)).toBe(30000);
  });

  it('never gives up: falls back to a slow retry after the fast attempts', () => {
    expect(retryDelay(8, 0)).toBe(60000);
    expect(retryDelay(100, 0)).toBe(60000);
  });
});
