import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { type AdminSession, getSession } from './session';

const BASE = process.env.GEZGIN_API_URL ?? 'http://localhost:3100/api/v1';
/** Brauzerdə yalnız sessiya id-si — tokenlər serverdədir (bax: session.ts). */
export const SESSION_COOKIE = 'gezgin_admin_sid';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Refresh token rotasiya olunur — eyni sessiyanın paralel sorğuları tək refresh-i gözləyir. */
function refresh(session: AdminSession): Promise<boolean> {
  session.refreshing ??= (async () => {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const pair = (await res.json()) as { accessToken: string; refreshToken: string };
    session.accessToken = pair.accessToken;
    session.refreshToken = pair.refreshToken;
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      session.refreshing = undefined;
    });
  return session.refreshing;
}

/**
 * Panelin bütün sorğuları serverdə gedir — brauzer tokenləri görmür.
 * 401 gələndə token bir dəfə yenilənir və sorğu təkrarlanır; alınmasa girişə.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const session = getSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');

  const send = (token: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
      cache: 'no-store',
    });

  const used = session.accessToken;
  let res = await send(used);
  // Başqa sorğu artıq yeniləyibsə təzə tokenlə təkrarla, yoxsa özün yenilə
  if (res.status === 401 && (session.accessToken !== used || (await refresh(session)))) {
    res = await send(session.accessToken);
  }
  if (res.status === 401) redirect('/login');
  const body = (await res.json()) as T & { code?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, body.code ?? 'INTERNAL', body.message ?? 'Sorğu alınmadı');
  return body;
}

/** Login səhifəsi sessiya yaranmamışdan əvvəl çağırır. */
export async function login(
  identifier: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: { role: string; username: string } }> {
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

/**
 * Server action-da API xətası bütün səhifəni "Application error" ilə yıxmasın —
 * mesaj qaytarılır, çağıran onu `?error=` ilə formaya göstərir.
 */
export async function attempt(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    unstable_rethrow(e); // 401 → /login yönləndirməsi olduğu kimi keçsin
    return e instanceof ApiError ? e.message : 'Əməliyyat alınmadı';
  }
}

/** Çıxış: refresh token serverdə də ləğv olunur (oğurlanmış cookie ilə davam etmək olmasın). */
export async function revoke(refreshToken: string): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  }).catch(() => undefined);
}
