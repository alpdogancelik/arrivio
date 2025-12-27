import { fetchMe, login as apiLogin, refreshSession, register as apiRegister, type RegisterPayload } from '@/api/auth';
import { configureClient } from '@/api/client';
import { mapApiError } from '@/api/errors';
import { USE_MOCK_DATA } from '@/config/mock';
import { getMockSession } from '@/mock/data';
import { clearTokens, loadTokens, saveTokens } from '@/storage/token-store';
import { AuthTokens, User } from '@/types/api';
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'error';

type AuthContextType = {
  user: User | null;
  tokens: AuthTokens | null;
  status: AuthStatus;
  error?: string;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (payload: RegisterPayload) => Promise<{ ok: boolean; message?: string }>;
  logout: (message?: string) => Promise<void>;
  refreshSession: () => Promise<AuthTokens | null>;
  setUser: (u: User | null) => void;
  updateUser: (changes: Partial<User>) => Promise<User | null>;
};

type State = {
  user: User | null;
  tokens: AuthTokens | null;
  status: AuthStatus;
  error?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => {
    if (!USE_MOCK_DATA) {
      return { user: null, tokens: null, status: 'checking', error: undefined };
    }
    const session = getMockSession();
    return { user: session.user, tokens: session.tokens, status: 'authenticated', error: undefined };
  });
  const tokensRef = useRef<AuthTokens | null>(null);
  const queryClient = useQueryClient();

  const logout = useCallback(
    async (message?: string) => {
      if (USE_MOCK_DATA) {
        const session = getMockSession();
        tokensRef.current = session.tokens;
        setState({ user: session.user, tokens: session.tokens, status: 'authenticated', error: message });
        return;
      }
      tokensRef.current = null;
      await clearTokens();
      setState({ user: null, tokens: null, status: 'unauthenticated', error: message });
      queryClient.clear();
    },
    [queryClient],
  );

  const refreshTokens = useCallback(async (): Promise<AuthTokens | null> => {
    const refreshToken = tokensRef.current?.refreshToken;
    if (!refreshToken) return null;

    try {
      const nextTokens = await refreshSession(refreshToken);
      tokensRef.current = nextTokens;
      await saveTokens(nextTokens);
      setState((s) => ({ ...s, tokens: nextTokens }));
      return nextTokens;
    } catch (error) {
      const err = mapApiError(error);
      if (err.status === 401 || err.status === 403) {
        await logout();
      }
      return null;
    }
  }, [logout]);

  useEffect(() => {
    configureClient({
      getTokens: () => tokensRef.current,
      refreshTokens,
      onUnauthorized: logout,
    });
  }, [logout, refreshTokens]);

  useEffect(() => {
    tokensRef.current = state.tokens;
  }, [state.tokens]);

  const hydrate = useCallback(async () => {
    setState((s) => ({ ...s, status: 'checking', error: undefined }));
    const stored = await loadTokens();
    if (!stored) {
      setState({ user: null, tokens: null, status: 'unauthenticated', error: undefined });
      return;
    }

    tokensRef.current = stored;
    setState((s) => ({ ...s, tokens: stored }));

    const activeTokens = (await refreshTokens()) ?? stored;
    tokensRef.current = activeTokens;
    await saveTokens(activeTokens);

    try {
      const profile = await fetchMe();
      if (profile.role && profile.role !== 'carrier') {
        await logout('Carrier role required');
        return;
      }

      setState({ user: profile, tokens: activeTokens, status: 'authenticated', error: undefined });
    } catch (error) {
      const err = mapApiError(error);
      await logout(err.message);
    }
  }, [logout, refreshTokens]);

  useEffect(() => {
    if (USE_MOCK_DATA) return;
    hydrate();
  }, [hydrate]);

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, status: 'checking', error: undefined }));
      try {
        const res = await apiLogin({ email, password });
        if (res.user.role && res.user.role !== 'carrier') {
          await logout('Carrier role required');
          return { ok: false, message: 'Carrier role required' };
        }

        tokensRef.current = res.tokens;
        await saveTokens(res.tokens);
        queryClient.clear();
        setState({ user: res.user, tokens: res.tokens, status: 'authenticated', error: undefined });
        return { ok: true };
      } catch (error) {
        const err = mapApiError(error);
        setState((s) => ({ ...s, status: 'unauthenticated', error: err.message }));
        return { ok: false, message: err.message };
      }
    },
    [logout, queryClient],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setState((s) => ({ ...s, status: 'checking', error: undefined }));
      try {
        const res = await apiRegister({ ...payload, role: payload.role ?? 'carrier' });
        const tokens = res.tokens ?? null;

        if (tokens) {
          tokensRef.current = tokens;
          await saveTokens(tokens);
        }

        setState((s) => ({
          ...s,
          user: res.user,
          tokens: tokens ?? null,
          status: tokens ? 'authenticated' : 'unauthenticated',
          error: undefined,
        }));

        if (res.user.role && res.user.role !== 'carrier') {
          await logout('Carrier role required');
          return { ok: false, message: 'Carrier role required' };
        }

        if (tokens) {
          queryClient.clear();
        }

        return { ok: true };
      } catch (error) {
        const err = mapApiError(error);
        setState((s) => ({ ...s, status: 'unauthenticated', error: err.message }));
        return { ok: false, message: err.message };
      }
    },
    [logout, queryClient],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user: state.user,
      tokens: state.tokens,
      status: state.status,
      error: state.error,
      login,
      register,
      logout,
      refreshSession: refreshTokens,
      setUser: (u: User | null) => setState((s) => ({ ...s, user: u })),
      updateUser: async (changes: Partial<User>) => {
        let updated: User | null = null;
        setState((s) => {
          if (!s.user) return s;
          updated = { ...s.user, ...changes };
          return { ...s, user: updated };
        });
        return updated;
      },
    }),
    [login, logout, refreshTokens, register, state.error, state.status, state.tokens, state.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
