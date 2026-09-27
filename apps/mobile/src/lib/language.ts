import type { QueryClient } from '@tanstack/react-query';
import { setContentLanguage } from '@/api/client';
import i18n from '@/i18n';
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
