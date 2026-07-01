'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { login as loginRequest, logout as logoutRequest, fetchMe } from '../lib/api/auth';
import { ApiError } from '../lib/api/client';
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
  /** True only while the initial boot fetch (session restore) is in flight. */
  isLoading: boolean;
  /**
   * True once the boot fetch resolves a valid session WITHOUT the user having
   * called `login()` this page-load — i.e. a silent session restore (Part 11
   * FR-4: "auto-login"). The login screen uses this to jump straight to
   * /dashboard instead of showing the "Enter Dashboard ->" confirmation card,
   * which stays reserved for a just-completed manual login.
   */
  sessionRestored: boolean;
  /** "Restoring session..." / "Session expired. Please sign in again." / null. */
  bootMessage: string | null;
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
  const [sessionRestored, setSessionRestored] = useState(false);
  const [bootMessage, setBootMessage] = useState<string | null>(null);

  const fetchPayload = useCallback(async () => {
    const data = await fetchMe();
    setPayload(data);
    return data;
  }, []);

  // Bootstrap from a stored token on mount (Part 11 "auto-login / session restore").
  useEffect(() => {
    const stored = getToken();
    // A literal "null"/"undefined" string (e.g. hand-edited in devtools) must be
    // treated the same as no token at all — FR-3's "rejects literal 'null'/'undefined'
    // strings" carried over from the legacy validateSession contract.
    if (!stored || stored === 'null' || stored === 'undefined') {
      if (stored) removeToken();
      setIsLoading(false);
      return;
    }
    setTokenState(stored);
    setBootMessage('Restoring session…');
    fetchPayload()
      .then(() => setSessionRestored(true))
      .catch((err) => {
        // Distinguish a DEFINITIVE auth failure (401 — expired/invalid token; apiFetch
        // has already stripped it from localStorage) from a TRANSIENT one (network
        // error / 5xx). Only the former clears local state — a transient failure keeps
        // the token so the next reload can retry the restore silently (FR-4).
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401) {
          setTokenState(null);
          setPayload(null);
          setBootMessage('Session expired. Please sign in again.');
        } else {
          setBootMessage(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [fetchPayload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: newToken } = await loginRequest(email, password);
      storeToken(newToken);
      setTokenState(newToken);
      await fetchPayload();
    },
    [fetchPayload],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Best-effort — clear locally regardless of server outcome.
    }
    removeToken();
    setTokenState(null);
    setPayload(null);
    setSessionRestored(false);
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
    sessionRestored,
    bootMessage,
    login,
    logout,
    refresh: async () => {
      await fetchPayload();
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
