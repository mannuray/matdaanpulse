// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Spinner from './Spinner';
import ErrorBoundary from './ErrorBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Boom(): never {
  throw new Error('Seat data mismatch');
}

describe('Spinner', () => {
  it('spins with Tailwind and is announced by its label', () => {
    render(<Spinner label="Loading seats…" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading seats…');
    expect(status.querySelector('.animate-spin')).not.toBeNull();
    expect(status.querySelector('.spinner')).toBeNull();
  });

  it('without a label it is named "Loading" and sized by `size`', () => {
    render(<Spinner size={12} />);
    const ring = screen.getByRole('status', { name: 'Loading' }).querySelector('.animate-spin') as HTMLElement;
    expect(ring.style.width).toBe('12px');
    expect(ring.style.height).toBe('12px');
  });
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary><p>Fine</p></ErrorBoundary>);
    expect(screen.getByText('Fine')).toBeTruthy();
  });

  it('shows a sentence-case card with the error message and a Reload button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReload = vi.fn();
    render(<ErrorBoundary onReload={onReload}><Boom /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
    expect(screen.getByText('Seat data mismatch')).toBeTruthy();
    expect(screen.queryByText(/Interface Error|RELOAD INTERFACE/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
