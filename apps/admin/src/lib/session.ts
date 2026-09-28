import { randomUUID } from 'node:crypto';

/**
 * Admin sessiyaları serverin yaddaşında saxlanılır, brauzerdə yalnız təsadüfi
 * sessiya id-si (httpOnly cookie) olur.
 *
 * Səbəb: API access token-i 15 dəqiqəlikdir. Panel əvvəllər yalnız onu cookie-də
 * saxlayırdı və moderator hər 15 dəqiqədən bir girişə atılırdı (qərar yazarkən
 * qeyd itirdi). Refresh token burada saxlanılır və token vaxtı bitəndə panel
 * özü yeniləyir. Server Component render-ində cookie yazmaq olmur, yaddaşdakı
 * sessiya isə yerindəcə yenilənir. Paralel sorğular bir refresh-i paylaşır —
 * refresh token rotasiya olunur, eyni tokeni iki dəfə göndərmək bütün sessiya
 * ailəsini ləğv edərdi.
 *
 * Konteyner yenidən başlayanda sessiyalar itir, admin yenidən daxil olur.
 */
export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  createdAt: number;
  refreshing?: Promise<boolean>;
}

/** Cookie-nin ömrü ilə eyni — bundan köhnə sessiya etibarsızdır. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Dev rejimində modul yenidən yüklənəndə sessiyalar itməsin
const store = ((globalThis as { __gezginAdminSessions?: Map<string, AdminSession> }).__gezginAdminSessions ??=
  new Map<string, AdminSession>());

export function createSession(data: Omit<AdminSession, 'createdAt' | 'refreshing'>): string {
  const now = Date.now();
  for (const [id, s] of store) if (now - s.createdAt > SESSION_TTL_MS) store.delete(id);
  const id = randomUUID();
  store.set(id, { ...data, createdAt: now });
  return id;
}

export function getSession(id: string | undefined): AdminSession | null {
  if (!id) return null;
  const s = store.get(id);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    store.delete(id);
    return null;
  }
  return s;
}

export function dropSession(id: string | undefined): AdminSession | null {
  if (!id) return null;
  const s = store.get(id) ?? null;
  store.delete(id);
  return s;
}
