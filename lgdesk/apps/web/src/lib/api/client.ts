import { getToken, removeToken } from '../auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_URL = `${API_URL}/api`;

/** Backend wraps every response as one of these two shapes (ResponseInterceptor). */
export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

/** Typed error thrown by `apiFetch` on any non-2xx / `{ok:false}` response. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Public auth endpoints whose 401s are EXPECTED (bad credentials / bad OTP) and
// must NOT trigger a session-expiry redirect — the calling page renders the error.
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/password-reset', '/auth/register'];

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serializable body, or a FormData instance for multipart uploads. */
  body?: unknown;
  params?: QueryParams;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

/**
 * Shared fetch client for all `lib/api/*` domain modules.
 * - Attaches the JWT bearer token from `lib/auth` (localStorage-backed, same as before).
 * - Unwraps the `{ok:true,data}` / `{ok:false,error}` envelope, throwing a typed `ApiError`.
 * - On a 401 (session expired — not an expected public-auth failure), clears the
 *   stored token and redirects to /login exactly once, centrally.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers: Record<string, string> = {};
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Network error — check your connection', 0);
  }

  let json: ApiEnvelope<T> | undefined;
  try {
    json = await res.json();
  } catch {
    // No/invalid JSON body — fall through to the generic error below.
  }

  if (res.status === 401) {
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => path.includes(p));
    if (!isPublicAuth && typeof window !== 'undefined') {
      removeToken();
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
  }

  if (!res.ok || !json || json.ok === false) {
    const message = json && json.ok === false ? json.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return json.data;
}

/** Pull a human-readable message out of an `ApiError` (or any other thrown error). */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) return err.message || fallback;
  const anyErr = err as { message?: string } | undefined;
  return anyErr?.message ?? fallback;
}
