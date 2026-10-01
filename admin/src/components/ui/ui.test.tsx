// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './Button';
import { StatusPill } from './Badge';

afterEach(cleanup);

describe('ui primitives', () => {
  it('Button defaults to type="button" and applies the variant', () => {
    render(<Button variant="primary">Save seat</Button>);
    const btn = screen.getByRole('button', { name: 'Save seat' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('bg-accent');
  });

  it('StatusPill renders sentence case labels', () => {
    render(<><StatusPill status="LEADING" /><StatusPill status="WON" /><StatusPill status="PENDING" /></>);
    expect(screen.getByText('Leading')).toBeTruthy();
    expect(screen.getByText('Won')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});
