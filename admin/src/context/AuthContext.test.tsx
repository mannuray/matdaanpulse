// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

/** A JWT-shaped token whose payload has `exp` (the admin only decodes it, never verifies). */
function token(expSecondsFromNow: number) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
}

function Probe() {
  const { isAuthenticated, logout } = useAuth();
  return (
    <>
      <span>{isAuthenticated ? 'in' : 'out'}</span>
      <button type="button" onClick={logout}>logout</button>
    </>
  );
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('AuthProvider logout (server-side revocation)', () => {
  it('an explicit logout asks the API to revoke the session, then clears it locally', async () => {
    const t = token(3600);
    localStorage.setItem('admin_token', t);
    localStorage.setItem('admin_user', JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('in')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('logout')); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${t}`);
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(screen.getByText('out')).toBeTruthy();
  });

  it('still logs out locally when the API call fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    localStorage.setItem('admin_token', token(3600));
    localStorage.setItem('admin_user', JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { fireEvent.click(screen.getByText('logout')); });
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(screen.getByText('out')).toBeTruthy();
  });

  it('an expired token is cleared locally without calling the API', async () => {
    localStorage.setItem('admin_token', token(-60));
    localStorage.setItem('admin_user', JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('out')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
