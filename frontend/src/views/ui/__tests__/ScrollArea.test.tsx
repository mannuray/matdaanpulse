// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScrollArea } from '../ScrollArea';

const proto = HTMLElement.prototype;
const saved = { sh: Object.getOwnPropertyDescriptor(proto, 'scrollHeight'), ch: Object.getOwnPropertyDescriptor(proto, 'clientHeight') };
afterEach(() => {
  cleanup();
  for (const [k, d] of [['scrollHeight', saved.sh], ['clientHeight', saved.ch]] as const) {
    if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k];
  }
});
const size = (scroll: number, client: number) => {
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => scroll });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => client });
};

describe('ScrollArea', () => {
  it('is a focusable labelled region with the scroll classes', () => {
    size(100, 100);
    render(<ScrollArea label="Parties">x</ScrollArea>);
    const r = screen.getByRole('region', { name: 'Parties' });
    expect(r.getAttribute('tabindex')).toBe('0');
    expect(r.className).toContain('overflow-y-auto');
    expect(r.className).toContain('overscroll-contain');
    expect(r.className).toContain('min-h-0');
  });

  it('shows the bottom fade only while more content is below', () => {
    size(400, 100);
    const { container } = render(<ScrollArea label="L">x</ScrollArea>);
    const region = screen.getByRole('region');
    expect(container.querySelector('[data-scroll-fade]')).toBeTruthy();
    region.scrollTop = 300;
    fireEvent.scroll(region);
    expect(container.querySelector('[data-scroll-fade]')).toBeNull();
    region.scrollTop = 100;
    fireEvent.scroll(region);
    expect(container.querySelector('[data-scroll-fade]')).toBeTruthy();
  });

  it('has no fade when the content fits', () => {
    size(100, 100);
    const { container } = render(<ScrollArea label="L">x</ScrollArea>);
    expect(container.querySelector('[data-scroll-fade]')).toBeNull();
  });

  it('the fade never takes pointer events and blends into the tile colour', () => {
    size(400, 100);
    const { container } = render(<ScrollArea label="L">x</ScrollArea>);
    const fade = container.querySelector('[data-scroll-fade]') as HTMLElement;
    expect(fade.className).toContain('pointer-events-none');
    expect(fade.style.background).toContain('var(--color-tile)');
  });

  it('resets to the top when resetKey changes', () => {
    size(400, 100);
    const { rerender } = render(<ScrollArea label="L" resetKey="a">x</ScrollArea>);
    const region = screen.getByRole('region');
    region.scrollTop = 200;
    rerender(<ScrollArea label="L" resetKey="a">x</ScrollArea>);
    expect(region.scrollTop).toBe(200);
    rerender(<ScrollArea label="L" resetKey="b">x</ScrollArea>);
    expect(region.scrollTop).toBe(0);
  });
});
