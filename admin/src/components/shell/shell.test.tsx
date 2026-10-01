// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const auth = { user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (r: string) => r === 'EDITOR' };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
afterEach(cleanup);

describe('Sidebar', () => {
  it('groups items under sentence-case headings and hides SUPER_ADMIN items for editors', () => {
    render(<MemoryRouter initialEntries={['/overrides']}><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Counting')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Audit logs')).toBeNull();
    expect(screen.getByRole('link', { name: /Live console/ }).getAttribute('aria-current')).toBe('page');
  });
});
