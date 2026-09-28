import i18n, { currentLang, tp, type Lang } from '@/i18n';

/**
 * Sosial ekranlar üçün vaxt və sayğac formatı — cari dilə görə.
 * Ekran 05: "2 saat əvvəl", ekran 08: "10:24 · Dünən · 2 gün", ekran 05: "1.2K".
 * Hermes-də `Intl` tarix lokalları etibarlı deyil — ay adları əl ilə.
 */

const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  az: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};

/** Həftə günləri `getDay()` sırası ilə (0 = bazar). */
const WEEKDAYS_SHORT: Record<Lang, readonly string[]> = {
  az: ['Ba', 'Be', 'Ça', 'Çr', 'Ca', 'Cü', 'Şə'], // i18n-ignore — həftə günlərinin qısaltmaları dil üzrə
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
};

/** Qısa ay adı cari dildə: 9 → "okt" / "Oct" / "окт". */
export const monthShort = (monthIndex: number): string => MONTHS_SHORT[currentLang()][monthIndex] ?? '';
/** Qısa həftə günü cari dildə: 0 → "Ba" / "Sun" / "Вс". */
export const weekdayShort = (dayIndex: number): string => WEEKDAYS_SHORT[currentLang()][dayIndex] ?? '';

/** "2 okt" / "Oct 2" / "2 окт" — ingiliscə ay əvvəl gəlir. */
function dayMonth(day: number, monthIndex: number): string {
  return currentLang() === 'en' ? `${monthShort(monthIndex)} ${day}` : `${day} ${monthShort(monthIndex)}`;
}

const NUMBER_LOCALE: Record<Lang, string> = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' };
/** Min ayırıcı ilə say: 3980 → "3.980" / "3,980" / "3 980". */
export const formatNumber = (n: number): string => n.toLocaleString(NUMBER_LOCALE[currentLang()]);

const pad2 = (n: number): string => String(n).padStart(2, '0');
const localClock = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export function timeAgo(value: string | Date, now = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return i18n.t('common:time.justNow');
  if (seconds < 3600) return tp('common:time.minutesAgo', Math.floor(seconds / 60));
  if (seconds < 86_400) return tp('common:time.hoursAgo', Math.floor(seconds / 3600));
  if (seconds < 172_800) return i18n.t('common:time.yesterday');
  if (seconds < 604_800) return tp('common:time.daysAgo', Math.floor(seconds / 86_400));
  const d = new Date(value);
  return dayMonth(d.getDate(), d.getMonth());
}

/** Söhbət siyahısı — bu gün saat, sonra "Dünən", "3 gün", "2 həftə". */
export function chatTime(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return localClock(date);
  const days = Math.ceil((startOfToday - date.getTime()) / 86_400_000);
  if (days <= 1) return i18n.t('common:time.yesterday');
  if (days < 7) return tp('common:time.days', days);
  if (days < 30) return tp('common:time.weeks', Math.floor(days / 7));
  return dayMonth(date.getDate(), date.getMonth());
}

/** Mesaj balonunun altındakı saat. */
export function clockTime(value: string | Date): string {
  return localClock(new Date(value));
}

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.round(n / 1000)}K`;
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** Çatdakı gün ayırıcısı — "Bu gün", "Dünən", "12 sen". */
export function dayLabel(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  if (isSameDay(date, now)) return i18n.t('common:time.today');
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (isSameDay(date, yesterday)) return i18n.t('common:time.yesterday');
  return dayMonth(date.getDate(), date.getMonth());
}

/** Yerli təqvim tarixi (səyahət günləri kimi saatsız tarixlər): "5 okt" / "Oct 5". */
export function localShortDate(value: string | Date): string {
  const d = new Date(value);
  return dayMonth(d.getDate(), d.getMonth());
}

// ─────────────────── Bakı vaxtı ───────────────────
//
// Rezervasiya və slot vaxtları API-dən UTC ISO kimi gəlir. Ekranda isə
// həmişə Bakı vaxtı göstərilməlidir: 2026-10-01T23:00Z → "2 okt 2026, 03:00".
// Hermes-də `Intl` saat qurşağı dəstəyinə güvənmirik — Azərbaycan 2016-dan
// yay vaxtına keçmir (sabit UTC+4), ona görə ofset əl ilə tətbiq olunur.

/** Asia/Baku — UTC+4, yay vaxtı yoxdur. */
export const BAKU_OFFSET_MS = 4 * 3_600_000;
const DAY_MS = 86_400_000;

/** @deprecated `monthShort(i)` işlət — cari dilə görə ay adı. */
export const AZ_MONTHS_SHORT = MONTHS_SHORT.az;

type Instant = string | number | Date;

export interface BakuParts {
  year: number;
  /** 0–11 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = bazar */
  weekday: number;
}

/** UTC anını Bakı divar saatının hissələrinə ayırır. */
export function bakuParts(value: Instant): BakuParts {
  const d = new Date(new Date(value).getTime() + BAKU_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** "2 okt 2026" */
export function bakuDate(value: Instant): string {
  const p = bakuParts(value);
  return currentLang() === 'en' ? `${monthShort(p.month)} ${p.day}, ${p.year}` : `${p.day} ${monthShort(p.month)} ${p.year}`;
}

/** "2 okt" */
export function bakuShortDate(value: Instant): string {
  const p = bakuParts(value);
  return dayMonth(p.day, p.month);
}

/** "03:00" */
export function bakuTime(value: Instant): string {
  const p = bakuParts(value);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "2 okt 2026, 03:00" */
export function bakuDateTime(value: Instant): string {
  return `${bakuDate(value)}, ${bakuTime(value)}`;
}

/** "Cü" */
export function bakuWeekday(value: Instant): string {
  return weekdayShort(bakuParts(value).weekday);
}

/** Bakı təqvim günü — müqayisə və açar üçün: "2026-10-02". */
export function bakuDayKey(value: Instant): string {
  const p = bakuParts(value);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`;
}

/** Anın düşdüyü Bakı gününün başlanğıcı (00:00 Bakı), UTC millisaniyə ilə. */
export function bakuStartOfDay(value: Instant): number {
  const shifted = new Date(value).getTime() + BAKU_OFFSET_MS;
  const intoDay = ((shifted % DAY_MS) + DAY_MS) % DAY_MS;
  return shifted - intoDay - BAKU_OFFSET_MS;
}

/**
 * Bu gündən `days` gün sonra, Bakı vaxtı ilə saat `hour:00` — UTC millisaniyə.
 * Otel girişi (14:00) belə hesablanır; cihazın saat qurşağı rol oynamır.
 */
export function bakuDayAt(days: number, hour: number, now: number = Date.now()): number {
  return bakuStartOfDay(now) + days * DAY_MS + hour * 3_600_000;
}
