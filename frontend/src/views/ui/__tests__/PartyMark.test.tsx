// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PartyMark } from '../PartyMark';
import { Avatar } from '../Avatar';

afterEach(cleanup);

describe('PartyMark', () => {
  it('renders the image with the party label as alt text', () => {
    render(<PartyMark mark="/symbols/logos/BJP.svg" color="#f80" label="BJP" />);
    const img = screen.getByRole('img', { name: 'BJP' }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/symbols/logos/BJP.svg');
  });

  it('falls back to the colour dot when there is no mark', () => {
    const { container } = render(<PartyMark mark={null} color="#f80" label="IND" />);
    expect(container.querySelector('img')).toBeNull();
    const dot = container.querySelector('[data-party-dot]') as HTMLElement;
    expect(dot).toBeTruthy();
    // jsdom normalizes #f80 to rgb(255, 136, 0)
    expect((dot as HTMLElement).style.background).toBe('rgb(255, 136, 0)');
  });

  it('uses the fallback colour when color prop is null', () => {
    const { container } = render(<PartyMark mark={null} color={null} label="IND" />);
    const dot = container.querySelector('[data-party-dot]') as HTMLElement;
    expect(dot).toBeTruthy();
    expect((dot as HTMLElement).style.background).toBe('var(--color-fallback)');
  });

  it('falls back to the dot when the image fails to load', () => {
    const { container } = render(<PartyMark mark="/missing.svg" color="#0a0" label="RJD" />);
    const img = screen.getByRole('img', { name: 'RJD' });
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-party-dot]')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('shows initials when the photo is missing or broken', () => {
    const { rerender } = render(<Avatar name="Ram Kripal Yadav" photo={null} />);
    expect(screen.getByText('RY')).toBeTruthy();
    rerender(<Avatar name="Ram Kripal Yadav" photo="/x.png" />);
    const img = screen.getByRole('img', { name: 'Ram Kripal Yadav' });
    fireEvent.error(img);
    expect(screen.getByText('RY')).toBeTruthy();
  });
});
