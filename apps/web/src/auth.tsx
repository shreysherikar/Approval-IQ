import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from './api-client';

/**
 * SECURITY: tokens live only in React memory. Never persist auth tokens to
 * localStorage/sessionStorage (XSS exfiltration risk). The future-proof
 * alternative is an httpOnly cookie session managed by the API; this
 * in-memory store is the safe placeholder until then.
 */

export interface AuthUser {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeEmailFromJwt(token: string): string | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof decoded === 'object' && decoded !== null && 'email' in decoded) {
      const email = (decoded as { email: unknown }).email;
      return typeof email === 'string' ? email : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      setAccessToken(res.accessToken);
      const decoded = decodeEmailFromJwt(res.accessToken);
      setUser({ email: decoded ?? email });
    } catch (err) {
      setAccessToken(null);
      setUser(null);
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback((): void => {
    setAccessToken(null);
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: accessToken !== null,
      isLoading,
      error,
      login,
      logout,
    }),
    [user, accessToken, isLoading, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
