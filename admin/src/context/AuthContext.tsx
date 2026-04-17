import { createContext, useContext, useState, type ReactNode } from 'react';
import { login } from '../services/user.service';
import { setToken, clearToken } from '../services/auth.service';
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
    const stored = localStorage.getItem('admin_user');
    return stored ? JSON.parse(stored) : null;
  });

  const loginAction = async (email: string, password: string) => {
    const result = await login(email, password);
    setToken(result.access_token);
    setUser(result.user);
    localStorage.setItem('admin_user', JSON.stringify(result.user));
  };

  const logout = () => {
    clearToken();
    setUser(null);
    localStorage.removeItem('admin_user');
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login: loginAction, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
