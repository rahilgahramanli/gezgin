import type { Lang } from './lang';

/** Rus dilində cəm forması: 1 день, 2 дня, 5 дней (11–14 həmişə "many"). */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const enPlural = (n: number, one: string, other: string): string => (n === 1 ? one : other);

/** "3 gün" / "3 days" / "3 дня" — marşrut və saxlanılanların alt başlığı. */
export function daysText(n: number, lang: Lang): string {
  if (lang === 'en') return `${n} ${enPlural(n, 'day', 'days')}`;
  if (lang === 'ru') return `${n} ${ruPlural(n, 'день', 'дня', 'дней')}`;
  return `${n} gün`;
}

/** "2 gecə" / "2 nights" / "2 ночи" — otel paketi sətri. */
export function nightsText(n: number, lang: Lang): string {
  if (lang === 'en') return `${n} ${enPlural(n, 'night', 'nights')}`;
  if (lang === 'ru') return `${n} ${ruPlural(n, 'ночь', 'ночи', 'ночей')}`;
  return `${n} gecə`;
}

/** "Level 12" — rus dilində "Уровень 12" (lüğət: Level N → Уровень N). */
export const levelText = (n: number | string, lang: Lang): string => (lang === 'ru' ? `Уровень ${n}` : `Level ${n}`);

const DATE_LOCALES: Record<Lang, string> = { az: 'az-AZ', en: 'en-GB', ru: 'ru-RU' };

/** "12 oktyabr" / "12 October" / "12 октября" — tədbir tarixi. */
export const dayMonthText = (date: Date, lang: Lang): string =>
  date.toLocaleDateString(DATE_LOCALES[lang], { day: 'numeric', month: 'long' });
