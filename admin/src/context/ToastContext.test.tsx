// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, toastDuration, useToast } from './ToastContext';
import { ApiError } from '../services/api-client';

function Probe() {
  const { toast, toastError } = useToast();
  return (
    <>
      <button type="button" onClick={() => toast('Seat saved')}>ok</button>
      <button type="button" onClick={() => toast('Heads up', 'info')}>info</button>
      <button type="button" onClick={() => toastError(new ApiError('Name is taken', 409), 'Update failed')}>err</button>
      <button type="button" onClick={() => toast('Line one\nLine two', 'error')}>multi</button>
    </>
  );
}

const renderProbe = () => render(<ToastProvider><Probe /></ToastProvider>);

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('ToastProvider', () => {
  it('a success toast is a polite status message that leaves after 4 s', () => {
    renderProbe();
    fireEvent.click(screen.getByText('ok'));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Seat saved');
    expect(status.getAttribute('aria-live')).toBe('polite');
    act(() => { vi.advanceTimersByTime(3999); });
    expect(screen.queryByText('Seat saved')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('Seat saved')).toBeNull();
  });

  it('info is a status too', () => {
    renderProbe();
    fireEvent.click(screen.getByText('info'));
    expect(screen.getByRole('status').textContent).toContain('Heads up');
  });

  it('toastError is an alert built by describeError; multi-line messages stay 8 s', () => {
    renderProbe();
    fireEvent.click(screen.getByText('err'));
    expect(screen.getByRole('alert').textContent).toContain('Update failed: Name is taken');
    fireEvent.click(screen.getByText('multi'));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText(/Update failed/)).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Line one');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the close button dismisses a toast at once', () => {
    renderProbe();
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Seat saved')).toBeNull();
  });

  it('renders in a portal on document.body, outside the app tree', () => {
    const { container } = renderProbe();
    fireEvent.click(screen.getByText('ok'));
    expect(container.contains(screen.getByRole('status'))).toBe(false);
    expect(document.body.contains(screen.getByRole('status'))).toBe(true);
  });

  it('toastDuration: 4 s, or 8 s for a multi-line message', () => {
    expect(toastDuration('Saved')).toBe(4000);
    expect(toastDuration('Failed\n• name: required')).toBe(8000);
  });
});
