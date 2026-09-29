import { describe, it, expect } from 'vitest';
import { validateOverride } from './override-validation';

const RID = '11111111-1111-1111-1111-111111111111';

describe('validateOverride', () => {
  it('accepts valid input and converts to numbers', () => {
    expect(validateOverride(RID, { votes: '1200', margin: ' 35 ', status: 'LEADING' })).toEqual({
      ok: true,
      payload: { result_id: RID, votes: 1200, margin: 35, status: 'LEADING' },
    });
  });

  it('accepts zero', () => {
    expect(validateOverride(RID, { votes: '0', margin: '0', status: 'LOST' }).ok).toBe(true);
  });

  it('rejects empty inputs instead of sending NaN', () => {
    const r = validateOverride(RID, { votes: '', margin: '10', status: 'WON' });
    expect(r.ok).toBe(false);
    const r2 = validateOverride(RID, { votes: '10', margin: '', status: 'WON' });
    expect(r2.ok).toBe(false);
  });

  it('rejects negative, decimal and non-numeric values', () => {
    for (const bad of ['-5', '1.5', 'abc', '1e3', 'NaN']) {
      expect(validateOverride(RID, { votes: bad, margin: '0', status: 'WON' }).ok).toBe(false);
      expect(validateOverride(RID, { votes: '0', margin: bad, status: 'WON' }).ok).toBe(false);
    }
  });

  it('rejects unknown status and missing result id', () => {
    expect(validateOverride(RID, { votes: '1', margin: '1', status: '' }).ok).toBe(false);
    expect(validateOverride(RID, { votes: '1', margin: '1', status: 'DRAW' }).ok).toBe(false);
    expect(validateOverride(null, { votes: '1', margin: '1', status: 'WON' }).ok).toBe(false);
  });
});
