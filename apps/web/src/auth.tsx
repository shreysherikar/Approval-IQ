import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from './api-client';

/**
 * SECURITY: the ACCESS token lives only in React memory. Never persist auth
 * tokens to localStorage/sessionStorage (XSS exfiltration risk). To survive a
 * browser reload, the long-lived REFRESH token is held in an httpOnly cookie
 * managed by the API (set at login, POST /auth/refresh mints a fresh access
 * token) — the safe placeholder design documented here since Phase 1.
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
    // Server clears the httpOnly refresh cookie so the session can't be restored.
    void authApi.logout().catch(() => undefined);
  }, []);

  /**
   * Session restore: after a browser reload the in-memory access token is
   * gone, which previously made the (authorization-protected) document list
   * appear empty on the roadmap — the uploaded document "disappeared". The
   * httpOnly refresh cookie lets us silently mint a fresh access token on
   * boot; failure just means there is no session to restore.
   */
  useEffect(() => {
    let cancelled = false;
    authApi
      .refresh()
      .then((res) => {
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setUser({ email: decodeEmailFromJwt(res.accessToken) ?? '' });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
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
