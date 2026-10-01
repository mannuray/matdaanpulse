// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isBare } from './Layout';

describe('isBare', () => {
  it('"/" (Dashboard) is bare only as an exact path; it does not make every route bare', () => {
    expect(isBare('/')).toBe(true);
    expect(isBare('/parties')).toBe(true);
    expect(isBare('/parties/BJP')).toBe(true);
    expect(isBare('/nowhere')).toBe(false);
  });
});
