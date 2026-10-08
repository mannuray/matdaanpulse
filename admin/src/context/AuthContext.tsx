import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { login, revokeSession } from '../services/user.service';
import { setToken, clearToken, getToken } from '../services/auth.service';
import { isTokenExpired } from '../utils/jwt';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // A stored user only counts as a session if a non-expired token is present too
    if (isTokenExpired(getToken())) {
      clearToken();
      return null;
    }
    try {
      const stored = localStorage.getItem('admin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      clearToken();
      return null;
    }
  });

  const loginAction = async (email: string, password: string) => {
    const result = await login(email, password);
    setToken(result.access_token);
    setUser(result.user);
    localStorage.setItem('admin_user', JSON.stringify(result.user));
  };

  /** Local only: forget the token and user (an expired token needs nothing more). */
  const clearSession = () => {
    clearToken();
    setUser(null);
    localStorage.removeItem('admin_user');
  };

  /** The user's explicit logout: revoke the token server-side (best effort, not awaited), then clear locally. */
  const logout = () => {
    void revokeSession(getToken());
    clearSession();
  };

  // Re-checked on every render so a token that expires mid-session logs the user out
  const token = getToken();
  const isAuthenticated = !!user && !!token && !isTokenExpired(token);

  useEffect(() => {
    if (user && !isAuthenticated) clearSession();
  }, [user, isAuthenticated]);

  const hasRole = (...roles: string[]) => {
    if (!user || !isAuthenticated) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login: loginAction, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
