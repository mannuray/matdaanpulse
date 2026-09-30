import { isSafeUrl } from './safe-url';

describe('isSafeUrl', () => {
  it.each(['https://en.wikipedia.org/wiki/X', 'http://example.com/a.png?x=1'])('accepts %s', (u) => {
    expect(isSafeUrl(u)).toBe(true);
  });

  it.each([
    'javascript:alert(document.cookie)',
    'JAVASCRIPT:alert(1)',
    'data:text/html;base64,xxx',
    'ftp://example.com/x',
    '//evil.com/x',
    'example.com',
    '/symbols/logos/BJP.svg',
    '',
    `https://e.com/${'a'.repeat(2048)}`,
    42,
  ])('rejects %p', (u) => {
    expect(isSafeUrl(u)).toBe(false);
  });

  it('allows site-relative paths only when asked', () => {
    expect(isSafeUrl('/symbols/logos/BJP.svg', true)).toBe(true);
    expect(isSafeUrl('//evil.com/x', true)).toBe(false);
    expect(isSafeUrl('/\\evil.com', true)).toBe(false);
    expect(isSafeUrl('javascript:alert(1)', true)).toBe(false);
  });
});
