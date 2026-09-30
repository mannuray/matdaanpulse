import { resolveRequestId } from './request-context';

describe('resolveRequestId', () => {
  it('keeps a well-formed incoming id', () => {
    expect(resolveRequestId('abc-123_XYZ')).toBe('abc-123_XYZ');
    expect(resolveRequestId('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it('replaces oversized, malformed or missing ids with a UUID', () => {
    const uuid = /^[0-9a-f-]{36}$/;
    expect(resolveRequestId('a'.repeat(65))).toMatch(uuid);
    expect(resolveRequestId('bad id\nwith newline')).toMatch(uuid);
    expect(resolveRequestId('<script>')).toMatch(uuid);
    expect(resolveRequestId('')).toMatch(uuid);
    expect(resolveRequestId(undefined)).toMatch(uuid);
    expect(resolveRequestId(['a', 'b'])).toMatch(uuid);
  });
});
