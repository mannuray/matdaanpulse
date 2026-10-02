// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageShell } from '../page/PageShell';

afterEach(cleanup);

describe('PageShell', () => {
  it('scrolls itself (the app shell never scrolls) with a sticky header inside the scroller', () => {
    const { container } = render(<MemoryRouter><PageShell back={{ href: '/', label: 'Back' }}><p>body</p></PageShell></MemoryRouter>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-full');
    expect(root.className).toContain('overflow-y-auto');
    const header = root.querySelector('header')!;
    expect(header.parentElement).toBe(root);
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
  });
});
