import { create } from 'zustand';
import { rawPost, setAccessToken, setRefreshHandler } from '@/api/client';
import { STORAGE_KEYS, storage } from '@/lib/storage';

export interface SessionUser {
  publicId: string;
  username: string;
  fullName: string;
  email: string | null;
  role: 'gezgin' | 'local_expert' | 'business' | 'admin';
  level: number;
  xp: number;
  gezginScore: number;
  isGuest: boolean;
  onboardingCompleted: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** Çıxışdan sonra giriş axınında birbaşa açılacaq ekran. */
export type AuthEntry = 'Register' | 'Login';

interface AuthState {
  session: Session | null;
  /** Yaddaşdan bərpa bitənə qədər açılış ekranı göstərilir. */
  isRestoring: boolean;
  /**
   * Qonaq "Hesab yarat" deyəndə sessiya bağlanır və giriş axını açılır —
   * Splash bu dəyəri oxuyub Qeydiyyat ekranına keçir (geri düyməsi Splash-a qayıdır).
   */
  pendingAuthEntry: AuthEntry | null;
  signIn: (session: Session) => Promise<void>;
  signOut: (next?: AuthEntry) => Promise<void>;
  consumeAuthEntry: () => AuthEntry | null;
  restore: () => Promise<void>;
  patchUser: (patch: Partial<SessionUser>) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  isRestoring: true,
  pendingAuthEntry: null,

  async signIn(session) {
    setAccessToken(session.accessToken);
    await storage.setJson(STORAGE_KEYS.session, session);
    set({ session });
  },

  async signOut(next) {
    setAccessToken(null);
    await storage.remove(STORAGE_KEYS.session);
    set({ session: null, pendingAuthEntry: next ?? null });
  },

  consumeAuthEntry() {
    const entry = get().pendingAuthEntry;
    if (entry) set({ pendingAuthEntry: null });
    return entry;
  },

  async restore() {
    const saved = await storage.getJson<Session>(STORAGE_KEYS.session);
    if (saved?.accessToken) setAccessToken(saved.accessToken);
    set({ session: saved, isRestoring: false });

    // 401 gələndə klient bu funksiyanı çağırıb tokeni yeniləyir.
    // Refresh token rotasiya olunur — yeni cütü mütləq yaddaşa yazmalıyıq,
    // əks halda köhnə token təkrar göndərilib bütün sessiyanı ləğv etdirər.
    setRefreshHandler(async () => {
      const current = get().session;
      if (!current?.refreshToken) return null;
      try {
        const pair = await rawPost<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          refreshToken: current.refreshToken,
        });
        const next: Session = { ...current, ...pair };
        setAccessToken(next.accessToken);
        await storage.setJson(STORAGE_KEYS.session, next);
        set({ session: next });
        return next.accessToken;
      } catch {
        await get().signOut();
        return null;
      }
    });
  },

  patchUser(patch) {
    const current = get().session;
    if (!current) return;
    const next = { ...current, user: { ...current.user, ...patch } };
    void storage.setJson(STORAGE_KEYS.session, next);
    set({ session: next });
  },
}));

/** Ekranlarda tez-tez lazım olan törəmələr. */
export const useUser = () => useAuth((s) => s.session?.user ?? null);
export const useIsAuthenticated = () => useAuth((s) => s.session !== null);
/** Qonaq rezervasiya, ödəniş və kart əməliyyatları edə bilmir (server 403 qaytarır). */
export const useIsGuest = () => useAuth((s) => s.session?.user.isGuest ?? false);
