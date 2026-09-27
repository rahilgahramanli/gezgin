import { create } from 'zustand';
import { ApiError, NETWORK_ERROR, api, rawPost, setAccessToken, setRefreshHandler } from '@/api/client';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { restoreLanguage } from '@/lib/language';

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

/** Giriş axını hansı ekrandan açılsın — qonaq "Qeydiyyatdan keç" deyəndə birbaşa Register. */
export type AuthEntry = 'Splash' | 'Login' | 'Register';

interface AuthState {
  session: Session | null;
  authEntry: AuthEntry;
  /** Qonaq sessiyasını bağlayıb qeydiyyat ekranını açır. */
  upgradeGuest: () => Promise<void>;
  /** Yaddaşdan bərpa bitənə qədər açılış ekranı göstərilir. */
  isRestoring: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
  patchUser: (patch: Partial<SessionUser>) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  authEntry: 'Splash',
  isRestoring: true,

  async upgradeGuest() {
    set({ authEntry: 'Register' });
    await get().signOut();
  },

  async signIn(session) {
    setAccessToken(session.accessToken);
    await storage.setJson(STORAGE_KEYS.session, session);
    set({ session, authEntry: 'Splash' });
  },

  async signOut() {
    setAccessToken(null);
    await storage.remove(STORAGE_KEYS.session);
    set({ session: null });
  },

  async restore() {
    await restoreLanguage();
    const saved = await storage.getJson<Session>(STORAGE_KEYS.session);
    if (saved?.accessToken) setAccessToken(saved.accessToken);
    set({ session: saved });

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
      } catch (e) {
        // İnternet yoxdursa sessiyanı silmirik — server rədd edəndə çıxarırıq
        if (!(e instanceof ApiError && e.code === NETWORK_ERROR)) await get().signOut();
        return null;
      }
    });

    // Onboarding yarımçıq qalıbsa (tətbiq 3-cü addımda bağlanıb) serverin
    // vəziyyətini soruşuruq — maraqlar artıq yazılıbsa 2-ci addım təkrar açılmır.
    if (saved && !saved.user.onboardingCompleted && !saved.user.isGuest) {
      try {
        const me = await api<{ onboardingCompleted: boolean }>('/me');
        if (me.onboardingCompleted) get().patchUser({ onboardingCompleted: true });
      } catch {
        // şəbəkə yoxdursa yerli vəziyyətlə davam edirik
      }
    }
    set({ isRestoring: false });
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
