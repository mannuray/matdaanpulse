// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '../../i18n';
import { JumpLinks } from '../party/page/JumpLinks';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('JumpLinks', () => {
  it('keeps one observer while the sections stay the same (a new but equal list, e.g. on each search keystroke)', () => {
    const made = vi.fn();
    vi.stubGlobal('IntersectionObserver', class { constructor() { made(); } observe() {} disconnect() {} });
    const { rerender } = render(<JumpLinks sections={['record', 'map']} />);
    rerender(<JumpLinks sections={['record', 'map']} />);
    rerender(<JumpLinks sections={['record', 'map']} />);
    expect(made).toHaveBeenCalledTimes(1);
    rerender(<JumpLinks sections={['record', 'map', 'mlas']} />);
    expect(made).toHaveBeenCalledTimes(2);
  });
});
