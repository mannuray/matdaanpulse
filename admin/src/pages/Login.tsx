import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api-client';
import { describeError } from '../utils/api-error';
import { returnPath } from '../components/routing/ProtectedRoute';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';

export const INVALID_LOGIN = 'Invalid email or password';
export const TOO_MANY_LOGINS = 'Too many attempts — wait a minute and try again';
export const MISSING_LOGIN = 'Enter your email and password';

/**
 * One banner message per failure. 400 is the backend's own validation (e.g. a password under 8 characters),
 * which is just a wrong password to the person signing in. 429 is the 5-per-minute sign-in throttle.
 */
export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 400) return INVALID_LOGIN;
    if (err.status === 429) return TOO_MANY_LOGINS;
  }
  return describeError(err, 'Sign-in failed');
}

/** PAGE: sign in (outside the shell). Returns to the page that sent the user here. */
export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const target = returnPath(state);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !submitting) return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const address = email.trim();
    if (!address || !password) { setError(MISSING_LOGIN); return; }
    setError(null);
    setSubmitting(true);
    try {
      await login(address, password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="tw-ui flex min-h-screen flex-col items-center justify-center bg-page px-4 font-sans text-ink">
      <form
        noValidate
        aria-labelledby="signin-title"
        onSubmit={(e) => { void submit(e); }}
        className="w-full max-w-[400px] rounded-panel border border-line bg-card p-8 shadow-sm"
      >
        <img src="/logo-mark.png" alt="" className="h-12 w-12 rounded-card" />
        <h1 id="signin-title" className="mt-4 text-xl font-semibold tracking-tight text-ink">MatdaanPulse Admin</h1>
        <p className="mt-1 text-sm text-ink-2">Sign in to manage elections and live results</p>
        <div className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@matdaanpulse.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={submitting} className="mt-5 w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-control border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-text">
            <AlertCircle size={14} aria-hidden className="shrink-0" />
            {error}
          </div>
        )}
      </form>
      <p className="mt-6 text-xs text-muted">Admin access only · accounts are created by a super admin</p>
    </div>
  );
}
