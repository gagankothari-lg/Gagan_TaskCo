'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { logout as logoutRequest, fetchMe } from '../lib/api/auth';
import { ApiError } from '../lib/api/client';
import { getToken, removeToken } from '../lib/auth';
import { redirectToPortalLogin } from '../lib/portal';
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
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // One QueryClient per app instance. staleTime ≥ 30s per CLAUDE.md perf guidance.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
      }),
  );

  const [token, setTokenState] = useState<string | null>(null);
  const [payload, setPayload] = useState<InitialPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayload = useCallback(async () => {
    const data = await fetchMe();
    setPayload(data);
    return data;
  }, []);

  // Bootstrap from a stored token on mount -- the only way a session ever starts now is
  // Portal handing one off via /sso-callback (Phase 7b: LGDesk has no login of its own).
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
    fetchPayload()
      .catch((err) => {
        // Distinguish a DEFINITIVE auth failure (401 — expired/invalid token; apiFetch
        // has already stripped it from localStorage) from a TRANSIENT one (network
        // error / 5xx). Only the former clears local state — a transient failure keeps
        // the token so the next reload can retry the restore silently. Either way,
        // layout-client.tsx's protect-effect sends an unauthenticated user to Portal
        // once isLoading settles.
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401) {
          setTokenState(null);
          setPayload(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [fetchPayload]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Best-effort — clear locally regardless of server outcome.
    }
    removeToken();
    setTokenState(null);
    setPayload(null);
    redirectToPortalLogin();
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
