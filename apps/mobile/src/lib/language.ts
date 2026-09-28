import type { QueryClient } from '@tanstack/react-query';
import { api, setContentLanguage } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { refreshRealtimeLanguage } from '@/realtime/socket';
import i18n, { currentLang } from '@/i18n';
import { STORAGE_KEYS, storage } from './storage';

export type AppLanguage = 'az' | 'en' | 'ru';
const SUPPORTED: readonly AppLanguage[] = ['az', 'en', 'ru'];

/**
 * Dil seçimi: API kontenti (məkan, marşrut, region adları) bu dildə qaytarır,
 * seçim cihazda saxlanılır və bütün sorğular yenidən yüklənir ki, ekranlar
 * köhnə dildə qalmasın.
 */
export async function applyLanguage(lang: AppLanguage, qc?: QueryClient): Promise<void> {
  setContentLanguage(lang);
  void i18n.changeLanguage(lang);
  refreshRealtimeLanguage();
  await storage.set(STORAGE_KEYS.language, lang);
  if (qc) await qc.invalidateQueries();
}

/** Tətbiq açılanda əvvəlki seçimi bərpa edir (defolt — Azərbaycan dili). */
export async function restoreLanguage(): Promise<void> {
  const saved = (await storage.get(STORAGE_KEYS.language)) as AppLanguage | null;
  if (saved && SUPPORTED.includes(saved)) {
    setContentLanguage(saved);
    void i18n.changeLanguage(saved);
  }
}

/**
 * Giriş anında cihaz və hesab dilini uzlaşdırır — dil hesab tənzimləməsidir
 * (server bildirişləri də bu dildə göndərir):
 *  - mövcud hesab (onboarding bitib): başqa cihazda seçilmiş dil interfeysə keçir;
 *  - yeni hesab: server defoltu (az) cihazda artıq seçilmiş dili əzməsin — cihazın dili hesaba yazılır.
 * Dil ikinci dərəcəlidir: xəta girişi bloklamır.
 */
export async function syncAccountLanguage(user: { isGuest: boolean; onboardingCompleted: boolean }): Promise<void> {
  if (user.isGuest) return;
  try {
    if (!user.onboardingCompleted) {
      await api('/me/settings', { method: 'PATCH', body: { language: currentLang() } });
      return;
    }
    const settings = await api<{ language?: string }>('/me/settings');
    const lang = settings.language as AppLanguage | undefined;
    // Girişdən dərhal sonra başlayan sorğular köhnə dildə gedib — yenidən yüklənir
    if (lang && SUPPORTED.includes(lang) && lang !== currentLang()) await applyLanguage(lang, queryClient);
  } catch {
    // şəbəkə/servis xətası — cihazdakı dil qalır
  }
}
