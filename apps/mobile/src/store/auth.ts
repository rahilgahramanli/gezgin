import { Alert } from 'react-native';
import i18n from '@/i18n';
import { create } from 'zustand';
import { ApiError, NETWORK_ERROR, api, rawPost, setAccessToken, setRefreshHandler } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { restoreLanguage, syncAccountLanguage } from '@/lib/language';

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
  /** Qonaq sessiyasını bağlayıb qeydiyyat ekranını açır. */
  upgradeGuest: () => Promise<void>;
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

  async upgradeGuest() {
    await get().signOut('Register');
  },

  async signIn(session) {
    setAccessToken(session.accessToken);
    await storage.setJson(STORAGE_KEYS.session, session);
    // Keşdə əvvəlki hesabın (və ya qonağın) məlumatı qalmasın — sorğu açarları istifadəçiyə bağlı deyil
    queryClient.clear();
    set({ session });
    void syncAccountLanguage(session.user);
  },

  async signOut(next) {
    setAccessToken(null);
    await storage.remove(STORAGE_KEYS.session);
    set({ session: null, pendingAuthEntry: next ?? null });
    // Çıxışdan sonra növbəti hesab əvvəlkinin profilini, rezervasiyalarını, bildirişlərini görməməlidir
    queryClient.clear();
  },

  consumeAuthEntry() {
    const entry = get().pendingAuthEntry;
    if (entry) set({ pendingAuthEntry: null });
    return entry;
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
        if (e instanceof ApiError && e.code === NETWORK_ERROR) return null;
        await get().signOut();
        // Səssiz çıxış istifadəçini çaşdırır — səbəbi deyirik (dayandırılmış hesab, bitmiş sessiya)
        const inactive = e instanceof ApiError && e.code === 'FORBIDDEN';
        Alert.alert(
          i18n.t(inactive ? 'common:session.inactiveTitle' : 'common:session.expiredTitle'),
          i18n.t(inactive ? 'common:session.inactiveMessage' : 'common:session.expiredMessage'),
        );
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
/** Qonaq rezervasiya, ödəniş və kart əməliyyatları edə bilmir (server 403 qaytarır). */
export const useIsGuest = () => useAuth((s) => s.session?.user.isGuest ?? false);
