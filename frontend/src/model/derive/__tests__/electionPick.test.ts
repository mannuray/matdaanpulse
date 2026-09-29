import { describe, it, expect } from 'vitest';
import { pickLatestElection } from '../electionPick';
import type { Election } from '../../types';

const el = (id: string, type: 'LS' | 'VS', year: number, status: Election['status']) => ({ id, type, year, status }) as Election;

describe('pickLatestElection', () => {
  it('prefers non-Upcoming over a later Upcoming election', () => {
    expect(pickLatestElection([el('ls2029', 'LS', 2029, 'Upcoming'), el('ls2024', 'LS', 2024, 'Finalized'), el('ls2019', 'LS', 2019, 'Finalized')], 'LS')?.id).toBe('ls2024');
  });
  it('treats Live like Finalized', () => {
    expect(pickLatestElection([el('a', 'VS', 2026, 'Live'), el('b', 'VS', 2031, 'Upcoming')])?.id).toBe('a');
  });
  it('falls back to the latest Upcoming when nothing else exists', () => {
    expect(pickLatestElection([el('a', 'LS', 2029, 'Upcoming'), el('b', 'LS', 2034, 'Upcoming')], 'LS')?.id).toBe('b');
  });
  it('filters by type and returns null when empty', () => {
    expect(pickLatestElection([el('a', 'VS', 2025, 'Finalized')], 'LS')).toBeNull();
    expect(pickLatestElection([])).toBeNull();
  });
});
