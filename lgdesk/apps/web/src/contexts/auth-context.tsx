'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getToken, setToken as storeToken, removeToken } from '../lib/auth';
import type {
  InitialPayload,
  InitialPayloadUser,
  Task,
  Project,
  WorkFunction,
  User,
} from '../lib/types';

interface AuthContextValue {
  token: string | null;
  user: InitialPayloadUser | null; // alias of currentUser
  currentUser: InitialPayloadUser | null;
  tasks: Task[];
  projects: Project[];
  employees: User[];
  functions: WorkFunction[];
  pendingLeaveCount: number;
  pendingDdrCount: number;
  attCounts: Record<string, number>;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // One QueryClient per app instance. staleTime ≥ 30s per CLAUDE.md perf guidance.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );

  const [token, setTokenState] = useState<string | null>(null);
  const [payload, setPayload] = useState<InitialPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayload = useCallback(async () => {
    // Backend wraps responses as { ok:true, data: <InitialPayload> }.
    const res = await api.get('/auth/me');
    const data = res.data?.data as InitialPayload;
    setPayload(data);
    return data;
  }, []);

  // Bootstrap from a stored token on mount.
  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setTokenState(stored);
    fetchPayload()
      .catch(() => {
        removeToken();
        setTokenState(null);
        setPayload(null);
      })
      .finally(() => setIsLoading(false));
  }, [fetchPayload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post('/auth/login', { email, password });
      const { token: newToken } = res.data.data as { token: string };
      storeToken(newToken);
      setTokenState(newToken);
      await fetchPayload();
    },
    [fetchPayload],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort — clear locally regardless of server outcome.
    }
    removeToken();
    setTokenState(null);
    setPayload(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }, []);

  const value: AuthContextValue = {
    token,
    user: payload?.currentUser ?? null,
    currentUser: payload?.currentUser ?? null,
    tasks: payload?.tasks ?? [],
    projects: payload?.projects ?? [],
    employees: payload?.employees ?? [],
    functions: payload?.functions ?? [],
    pendingLeaveCount: payload?.pendingLeaveCount ?? 0,
    pendingDdrCount: payload?.pendingDdrCount ?? 0,
    attCounts: payload?.attCounts ?? {},
    isLoading,
    login,
    logout,
    refresh: async () => {
      await fetchPayload();
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}
