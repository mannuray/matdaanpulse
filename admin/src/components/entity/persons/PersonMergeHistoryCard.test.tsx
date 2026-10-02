import { describe, expect, it } from 'vitest';
import { notUndoableLabel } from './PersonMergeHistoryCard';
import type { PersonMerge } from '../../../types';

const base: PersonMerge = {
  id: 'm', duplicate_name: 'X', candidate_count: 1, merged_at: '2026-10-01T08:00:00.000Z', merged_by: null,
  undoable: false, undone_at: null, not_undoable_reason: null,
};

describe('notUndoableLabel', () => {
  it('shows the IST date for an undone merge', () => {
    expect(notUndoableLabel({ ...base, undone_at: '2026-10-02T04:30:00.000Z', not_undoable_reason: 'undone' })).toBe('Undone 02 Oct 2026, 10:00');
  });
  it('says a contest has moved', () => {
    expect(notUndoableLabel({ ...base, not_undoable_reason: 'contests_moved' })).toBe("Can't undo: a contest has moved since");
  });
  it('says the keeper is missing', () => {
    expect(notUndoableLabel({ ...base, not_undoable_reason: 'keeper_missing' })).toMatch(/no longer exists/);
  });
});
