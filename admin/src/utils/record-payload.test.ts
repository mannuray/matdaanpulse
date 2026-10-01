import { describe, it, expect } from 'vitest';
import { blankToNull } from './record-payload';

describe('blankToNull', () => {
  it('turns empty and whitespace-only strings into null and leaves everything else alone', () => {
    expect(blankToNull({ a: '', b: '  ', c: 'x', d: ' y ', n: 0, z: null, flag: false })).toEqual({ a: null, b: null, c: 'x', d: ' y ', n: 0, z: null, flag: false });
  });
});
