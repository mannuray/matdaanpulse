import { describe, it, expect } from 'vitest';
import { lifecycleActions } from './lifecycle';

const kinds = (status: 'Upcoming' | 'Live' | 'Finalized', role: string | undefined) =>
  lifecycleActions({ status }, role).map((a) => a.kind);

describe('lifecycleActions', () => {
  it('Upcoming → Live for SUPER_ADMIN and EDITOR', () => {
    expect(kinds('Upcoming', 'SUPER_ADMIN')).toEqual(['live']);
    expect(kinds('Upcoming', 'EDITOR')).toEqual(['live']);
    expect(lifecycleActions({ status: 'Upcoming' }, 'EDITOR')[0].label).toBe('Go live');
  });
  it('Live → Finalized for SUPER_ADMIN only', () => {
    expect(lifecycleActions({ status: 'Live' }, 'SUPER_ADMIN')).toEqual([{ kind: 'finalize', label: 'Finalize' }]);
    expect(kinds('Live', 'EDITOR')).toEqual([]);
  });
  it('Finalized → Live (reopen) for SUPER_ADMIN only', () => {
    expect(lifecycleActions({ status: 'Finalized' }, 'SUPER_ADMIN')).toEqual([{ kind: 'reopen', label: 'Reopen for corrections' }]);
    expect(kinds('Finalized', 'EDITOR')).toEqual([]);
  });
  it('viewers and signed-out users get nothing', () => {
    for (const s of ['Upcoming', 'Live', 'Finalized'] as const) {
      expect(kinds(s, 'VIEWER')).toEqual([]);
      expect(kinds(s, undefined)).toEqual([]);
    }
  });
});
