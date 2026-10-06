import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api,
  clearTokens,
  getRefreshToken,
  loadTokens,
  setOnRefreshFailed,
  setTokens,
} from '@/lib/api';
import type { User } from '@/lib/types';

interface AdminLoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  isAdmin: false,
  login: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.roles?.includes('admin') ?? false;

  const forgetSession = useCallback(async () => {
    await clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // A stored access token is usually already stale — /me returning 401
        // triggers the refresh inside the client, so the operator comes back to
        // a live session instead of the login screen.
        const saved = await loadTokens();
        if (saved) {
          const me = await api.get<User>('/me');
          setUser(me);
          setToken(saved);
        }
      } catch {
        await forgetSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [forgetSession]);

  // When the refresh token is rejected there is nothing left to retry with.
  useEffect(() => {
    setOnRefreshFailed(() => {
      forgetSession();
    });
    return () => setOnRefreshFailed(null);
  }, [forgetSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AdminLoginResponse>('/auth/admin/login', {
      email,
      password,
    });
    await setTokens(res.token, res.refresh_token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    // Revoke server-side first — a refresh token that outlives the session on
    // the server is a way back into the panel.
    const refresh = getRefreshToken();
    if (refresh) {
      await api.post('/auth/logout', { refresh_token: refresh }).catch(() => {});
    }
    await forgetSession();
  }, [forgetSession]);

  const value = React.useMemo(
    () => ({ user, token, loading, isAdmin, login, signOut }),
    [user, token, loading, isAdmin, login, signOut],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}
