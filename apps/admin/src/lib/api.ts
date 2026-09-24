import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const BASE = process.env.GEZGIN_API_URL ?? 'http://localhost:3100/api/v1';
export const TOKEN_COOKIE = 'gezgin_admin';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Panelin bütün sorğuları serverdə gedir — token yalnız httpOnly cookie-dədir,
 * brauzer JS-i ona toxuna bilmir.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (res.status === 401) redirect('/login');
  const body = (await res.json()) as T & { code?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, body.code ?? 'INTERNAL', body.message ?? 'Sorğu alınmadı');
  return body;
}

/** Login səhifəsi cookie qoyulmamışdan əvvəl çağırır — `cookies()` oxunmur. */
export async function login(identifier: string, password: string): Promise<{ accessToken: string; user: { role: string; username: string } }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
    cache: 'no-store',
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.code ?? 'UNAUTHORIZED', body.message ?? 'Giriş alınmadı');
  return body;
}
