const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
const TOKEN_KEY = 'portal_token';

export const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t: string) => typeof window !== 'undefined' && localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => typeof window !== 'undefined' && localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new ApiError(json?.error ?? `Request failed (${res.status})`, res.status, json?.code);
  }
  return json.data as T;
}
