import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use(config => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('lgdesk_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Public auth endpoints whose 401s are EXPECTED (bad credentials / bad OTP) and
// must NOT trigger a session-expiry redirect — the calling page renders the error.
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/password-reset', '/auth/register'];

api.interceptors.response.use(
  res => res,
  err => {
    const url: string = err.config?.url ?? '';
    const isPublicAuth = PUBLIC_AUTH_PATHS.some(p => url.includes(p));
    if (err.response?.status === 401 && !isPublicAuth && typeof window !== 'undefined') {
      localStorage.removeItem('lgdesk_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

/** Unwrap a `{ ok:true, data }` envelope, or throw the `{ ok:false, error }` string. */
export function unwrap<T>(body: ApiResponse<T>): T {
  if (body.ok) return body.data;
  throw new Error(body.error);
}

/** Pull a human-readable message out of an axios error carrying our error envelope. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
  return anyErr?.response?.data?.error ?? anyErr?.message ?? fallback;
}
