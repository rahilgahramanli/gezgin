/**
 * Sosial ekranlar üçün vaxt və sayğac formatı.
 * Ekran 05: "2 saat əvvəl", ekran 08: "10:24 · Dünən · 2 gün", ekran 05: "1.2K".
 */

export function timeAgo(value: string | Date, now = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'indicə';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dəq əvvəl`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} saat əvvəl`;
  if (seconds < 172_800) return 'Dünən';
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} gün əvvəl`;
  return new Date(value).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' });
}

/** Söhbət siyahısı — bu gün saat, sonra "Dünən", "3 gün", "2 həftə". */
export function chatTime(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) {
    return date.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const days = Math.ceil((startOfToday - date.getTime()) / 86_400_000);
  if (days <= 1) return 'Dünən';
  if (days < 7) return `${days} gün`;
  if (days < 30) return `${Math.floor(days / 7)} həftə`;
  return date.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' });
}

/** Mesaj balonunun altındakı saat. */
export function clockTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  if (isSameDay(date, now)) return 'Bu gün';
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (isSameDay(date, yesterday)) return 'Dünən';
  return date.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' });
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

/** Azərbaycanca qısa ay adları — "12 sen" (çat ayırıcısı) ilə eyni üslub. */
export const AZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'] as const;

/** Həftə günləri `getUTCDay()` sırası ilə (0 = bazar) — ekran 18 tarix zolağı. */
export const AZ_WEEKDAYS_SHORT = ['Ba', 'Be', 'Ça', 'Çr', 'Ca', 'Cü', 'Şə'] as const;

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

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "2 okt 2026" */
export function bakuDate(value: Instant): string {
  const p = bakuParts(value);
  return `${p.day} ${AZ_MONTHS_SHORT[p.month]} ${p.year}`;
}

/** "2 okt" */
export function bakuShortDate(value: Instant): string {
  const p = bakuParts(value);
  return `${p.day} ${AZ_MONTHS_SHORT[p.month]}`;
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
  return AZ_WEEKDAYS_SHORT[bakuParts(value).weekday] ?? '';
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
