// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ isAuthenticated: false, login: vi.fn(async (_e: string, _p: string) => {}) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
import Login from './Login';
import { ApiError } from '../services/api-client';

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

const renderLogin = (state?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

const signIn = (email = ' admin@matdaanpulse.in ', password = 'correct-horse') => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

afterEach(() => { cleanup(); auth.isAuthenticated = false; auth.login.mockReset(); auth.login.mockResolvedValue(undefined); });

describe('Login', () => {
  it('shows the card per the design with no banner before an attempt', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'MatdaanPulse Admin' })).toBeTruthy();
    expect(screen.getByText('Sign in to manage elections and live results')).toBeTruthy();
    expect(screen.getByText('Admin access only · accounts are created by a super admin')).toBeTruthy();
    expect((document.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('/logo-mark.png');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('401 → "Invalid email or password", with the trimmed email sent', async () => {
    auth.login.mockRejectedValueOnce(new ApiError('Invalid credentials', 401));
    renderLogin();
    signIn();
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(auth.login).toHaveBeenCalledWith('admin@matdaanpulse.in', 'correct-horse');
  });

  it('400 (a password under 8 characters fails backend validation) → the same message', async () => {
    auth.login.mockRejectedValueOnce(new ApiError('Validation failed', 400, 'VALIDATION', [{ field: 'password', message: 'too short' }]));
    renderLogin();
    signIn('admin@matdaanpulse.in', 'short');
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(auth.login).toHaveBeenCalledWith('admin@matdaanpulse.in', 'short');
  });

  it('429 → "Too many attempts — wait a minute and try again"', async () => {
    auth.login.mockRejectedValueOnce(new ApiError('ThrottlerException: Too Many Requests', 429));
    renderLogin();
    signIn();
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts — wait a minute and try again');
  });

  it('a network failure says so; a 5xx falls back to describeError', async () => {
    auth.login.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderLogin();
    signIn();
    expect((await screen.findByRole('alert')).textContent).toBe('Network error — check your connection');
    auth.login.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sign-in failed: Internal server error'));
  });

  it('empty fields ask for both without calling the API', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter your email and password');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('after signing in, returns to the page that sent the user here', async () => {
    renderLogin({ from: { pathname: '/logs', search: '?action=RESULT_OVERRIDE' } });
    signIn();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/logs?action=RESULT_OVERRIDE'));
  });

  it('never returns to /login or a protocol-relative path', async () => {
    renderLogin({ from: { pathname: '//evil.example/x' } });
    signIn();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });

  it('an already signed-in visit is redirected into the app', () => {
    auth.isAuthenticated = true;
    renderLogin({ from: { pathname: '/feedback' } });
    expect(screen.getByTestId('where').textContent).toBe('/feedback');
  });

  it('the eye button shows and hides the password', () => {
    renderLogin();
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(password.type).toBe('password');
    fireEvent.click(toggle);
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(password.type).toBe('password');
    expect(toggle.getAttribute('type')).toBe('button');
  });
});
