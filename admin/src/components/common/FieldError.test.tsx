// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { FieldError, FormErrorsContext } from './FieldError';
import { ToastProvider, useToast } from '../../context/ToastContext';
import { parseApiError } from '../../services/api-client';

afterEach(cleanup);

describe('FieldError', () => {
  it('renders the message for its field only', () => {
    render(
      <FormErrorsContext.Provider value={{ email: 'email must be an email' }}>
        <FieldError name="email" />
        <FieldError name="name" />
      </FormErrorsContext.Provider>,
    );
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe('email must be an email');
    expect(alerts[0].getAttribute('data-field-error')).toBe('email');
  });

  it('renders nothing without a provider or message', () => {
    const { container } = render(<FieldError name="email" />);
    expect(container.textContent).toBe('');
  });
});

describe('toastError', () => {
  it('shows the message and the field list in the toast', () => {
    let fire!: (e: unknown) => void;
    function Probe() {
      const { toastError } = useToast();
      fire = (e) => toastError(e, 'Operation failed');
      return null;
    }
    const { container } = render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    const err = parseApiError(400, '', {
      error: { message: 'Validation failed', fields: [{ field: 'email', message: 'email must be an email' }] },
    });
    act(() => fire(err));
    const toast = container.querySelector('.toast-error')!;
    expect(toast.textContent).toContain('Operation failed: Validation failed');
    expect(toast.textContent).toContain('email: email must be an email');
    act(() => fire(new TypeError('Failed to fetch')));
    expect(container.textContent).toContain('Network error');
  });
});
