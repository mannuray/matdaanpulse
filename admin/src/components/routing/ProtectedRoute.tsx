import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../ui/EmptyState';

interface FromState { from?: { pathname?: unknown; search?: unknown; hash?: unknown } }

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * Where to go after signing in: the in-app page that sent the user to /login (`state.from`, set below).
 * Anything else — no state, /login itself, a protocol-relative "//host" or a non-path value — goes to "/".
 */
export function returnPath(state: unknown): string {
  const from = (state as FromState | null | undefined)?.from;
  const pathname = text(from?.pathname);
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.startsWith('/\\') || pathname === '/login') return '/';
  return `${pathname}${text(from?.search)}${text(from?.hash)}`;
}

/** Signed-out users go to /login (remembering this page); a signed-in user without the role sees "Access denied". */
export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && roles.length > 0 && !roles.some((r) => hasRole(r))) {
    return (
      <div className="tw-ui flex h-full items-center justify-center bg-page p-10 font-sans">
        <EmptyState icon={ShieldAlert} title="Access denied" description="You do not have permission to view this page." />
      </div>
    );
  }
  return <>{children}</>;
}
