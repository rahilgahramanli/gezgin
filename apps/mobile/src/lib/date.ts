/**
 * Təqvim tarixləri — `toISOString()` UTC-dir, ona görə Bakıda 00:00–04:00
 * arası "5 okt" seçimi `2026-10-04` kimi gedirdi. Burada həmişə cihazın
 * YERLİ təqvim günü götürülür.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Yerli təqvim günü `YYYY-MM-DD` formatında — API tarix sahələri bunu gözləyir. */
export function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Bu gündən `days` gün sonra (yerli vaxtla, DST-dən asılı olmadan). */
export function addLocalDays(days: number, from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}
