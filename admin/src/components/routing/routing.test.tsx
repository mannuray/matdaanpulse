// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ isAuthenticated: false, roles: [] as string[] }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: auth.isAuthenticated, hasRole: (...r: string[]) => r.some((x) => auth.roles.includes(x)) }),
}));
import { ProtectedRoute, returnPath } from './ProtectedRoute';

function LoginProbe() {
  const { state } = useLocation();
  return <output data-testid="back">{returnPath(state)}</output>;
}

const renderAt = (at: string, roles?: string[]) => render(
  <MemoryRouter initialEntries={[at]}>
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route path="/feedback" element={<ProtectedRoute roles={roles}><p>Feedback inbox</p></ProtectedRoute>} />
    </Routes>
  </MemoryRouter>,
);

afterEach(() => { cleanup(); auth.isAuthenticated = false; auth.roles = []; });

describe('ProtectedRoute', () => {
  it('a signed-out visit goes to /login and remembers the page, including the query', () => {
    renderAt('/feedback?status=new');
    expect(screen.queryByText('Feedback inbox')).toBeNull();
    expect(screen.getByTestId('back').textContent).toBe('/feedback?status=new');
  });

  it('a signed-in user without the role sees "Access denied" in sentence case', () => {
    auth.isAuthenticated = true;
    auth.roles = ['VIEWER'];
    renderAt('/feedback', ['SUPER_ADMIN', 'EDITOR']);
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeTruthy();
    expect(screen.getByText('You do not have permission to view this page.')).toBeTruthy();
    expect(screen.queryByText('Feedback inbox')).toBeNull();
  });

  it('a signed-in user with the role sees the page', () => {
    auth.isAuthenticated = true;
    auth.roles = ['EDITOR'];
    renderAt('/feedback', ['SUPER_ADMIN', 'EDITOR']);
    expect(screen.getByText('Feedback inbox')).toBeTruthy();
  });
});

describe('returnPath', () => {
  it.each([
    [undefined, '/'],
    [null, '/'],
    [{}, '/'],
    [{ from: { pathname: '/logs', search: '?action=RESULT_OVERRIDE' } }, '/logs?action=RESULT_OVERRIDE'],
    [{ from: { pathname: '/candidates/c7', search: '', hash: '#top' } }, '/candidates/c7#top'],
    [{ from: { pathname: '/login' } }, '/'],
    [{ from: { pathname: '//evil.example/x' } }, '/'],
    [{ from: { pathname: 'https://evil.example' } }, '/'],
    [{ from: { pathname: 42 } }, '/'],
  ])('%j → %s', (state, expected) => {
    expect(returnPath(state)).toBe(expected);
  });
});
