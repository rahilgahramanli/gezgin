import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import azCommon from './locales/az/common.json';
import azAuth from './locales/az/auth.json';
import azSocial from './locales/az/social.json';
import azExplore from './locales/az/explore.json';
import azTrips from './locales/az/trips.json';
import azBooking from './locales/az/booking.json';
import azProfile from './locales/az/profile.json';
import azGamification from './locales/az/gamification.json';
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enSocial from './locales/en/social.json';
import enExplore from './locales/en/explore.json';
import enTrips from './locales/en/trips.json';
import enBooking from './locales/en/booking.json';
import enProfile from './locales/en/profile.json';
import enGamification from './locales/en/gamification.json';
import ruCommon from './locales/ru/common.json';
import ruAuth from './locales/ru/auth.json';
import ruSocial from './locales/ru/social.json';
import ruExplore from './locales/ru/explore.json';
import ruTrips from './locales/ru/trips.json';
import ruBooking from './locales/ru/booking.json';
import ruProfile from './locales/ru/profile.json';
import ruGamification from './locales/ru/gamification.json';

export type Lang = 'az' | 'en' | 'ru';
export const LANGS: readonly Lang[] = ['az', 'en', 'ru'];

/**
 * Tərcümələr sahələr üzrə bölünüb (namespace) — hər ekran qrupu öz faylındadır:
 * `t('booking:pay.button')`. Ortaq mətnlər `common`-dadır.
 */
export const NAMESPACES = ['common', 'auth', 'social', 'explore', 'trips', 'booking', 'profile', 'gamification'] as const;
export type Namespace = (typeof NAMESPACES)[number];

const resources = {
  az: {
    common: azCommon, auth: azAuth, social: azSocial, explore: azExplore,
    trips: azTrips, booking: azBooking, profile: azProfile, gamification: azGamification,
  },
  en: {
    common: enCommon, auth: enAuth, social: enSocial, explore: enExplore,
    trips: enTrips, booking: enBooking, profile: enProfile, gamification: enGamification,
  },
  ru: {
    common: ruCommon, auth: ruAuth, social: ruSocial, explore: ruExplore,
    trips: ruTrips, booking: ruBooking, profile: ruProfile, gamification: ruGamification,
  },
};

/**
 * Tətbiqin əsas dili Azərbaycan dilidir — ingilis dilli iPhone-da (en_AZ) da
 * interfeys azərbaycanca açılır. İstifadəçinin seçimi `lib/language.ts`-də
 * saxlanılır və açılışda bərpa olunur.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: 'az',
  fallbackLng: 'az',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const currentLang = (): Lang => (LANGS.includes(i18n.language as Lang) ? (i18n.language as Lang) : 'az');

/**
 * Cəm forması — Hermes-də `Intl.PluralRules` etibarlı deyil, ona görə qaydalar
 * əl ilə: azərbaycanca say ilə isim təkdə qalır (`_other`), ingiliscə 1/çox,
 * rusca 1 / 2–4 / 5+ (21 = one, 12–14 = many).
 */
export function pluralForm(count: number, lang: Lang = currentLang()): 'one' | 'few' | 'many' | 'other' {
  const n = Math.abs(Math.trunc(count));
  if (lang === 'az') return 'other';
  if (lang === 'en') return n === 1 ? 'one' : 'other';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

/**
 * Sayla mətn: `tp('common:time.daysAgo', 3)` → "3 gün əvvəl" / "3 days ago" / "3 дня назад".
 * Açarlar `_one/_few/_many/_other` şəkilçisi ilə yazılır; tapılmayan forma `_other`-ə düşür.
 */
export function tp(key: string, count: number, options: Record<string, unknown> = {}): string {
  const form = pluralForm(count);
  const specific = `${key}_${form}`;
  const k = i18n.exists(specific) ? specific : `${key}_other`;
  // `count` birbaşa verilsə i18next öz cəm məntiqini (Intl.PluralRules) işə salır —
  // formanı artıq seçmişik, ona görə say yalnız mətnə qoyulur
  const replace = { ...((options.replace as Record<string, unknown> | undefined) ?? {}), count };
  return i18n.t(k, { ...options, replace });
}

/**
 * Komponentlər üçün: dil dəyişəndə yenidən render olunur.
 *   const { t, tp } = useT('booking');
 *   t('pay.button', { total })         → booking:pay.button
 *   t('common:actions.retry')          → başqa namespace
 *   tp('slot.seatsLeft', seats)        → cəm formalı açar
 */
export function useT(ns: Namespace = 'common') {
  const { t, i18n: inst } = useTranslation(ns);
  const lang = (LANGS.includes(inst.language as Lang) ? inst.language : 'az') as Lang;
  const plural = (key: string, count: number, options: Record<string, unknown> = {}): string => {
    const full = key.includes(':') ? key : `${ns}:${key}`;
    return tp(full, count, options);
  };
  return { t, tp: plural, lang };
}

export default i18n;
