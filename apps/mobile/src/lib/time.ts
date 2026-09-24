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
