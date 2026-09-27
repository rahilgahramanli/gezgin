import type { Booking } from '@/api/hooks/booking';
import { bakuDate, bakuShortDate, bakuTime } from '@/lib/time';

type Tone = 'teal' | 'gold' | 'gray' | 'brown';

export const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: 'Təsdiqlənib', tone: 'teal' },
  awaiting_payment: { label: 'Ödəniş gözlənilir', tone: 'gold' },
  pending: { label: 'Gözləyir', tone: 'gold' },
  completed: { label: 'Tamamlandı', tone: 'gray' },
  cancelled: { label: 'Ləğv edilib', tone: 'gray' },
  // Ləğv edilib və pul karta qaytarılıb
  refunded: { label: 'Geri qaytarılıb', tone: 'brown' },
};

export const bookingStatus = (status: string) => BOOKING_STATUS[status] ?? { label: status, tone: 'gray' as const };

export const PAYMENT_STATUS: Record<string, string> = {
  created: 'Başladılıb',
  requires_action: 'Bank təsdiqi gözlənilir',
  succeeded: 'Ödənilib',
  failed: 'Alınmadı',
  refunded: 'Geri qaytarılıb',
  partially_refunded: 'Qismən geri qaytarılıb',
};

/** Ödənilməmiş rezervasiya — "Ödənişi tamamla" göstərilir. */
export const isPayable = (b: Pick<Booking, 'status'>): boolean =>
  b.status === 'awaiting_payment' || b.status === 'pending';

export const guestsLabel = (b: { adults: number; children: number }): string =>
  `${b.adults} böyük${b.children ? ` + ${b.children} uşaq` : ''}`;

/**
 * Siyahı kartındakı tarix sətri (Bakı vaxtı):
 * təcrübə — "22 noy 2026, 13:00", otel — "5 – 7 iyl 2026 · 2 gecə".
 */
export function bookingWhen(b: Pick<Booking, 'startAt' | 'endAt'>): string {
  if (!b.startAt) return 'Tarixsiz';
  if (b.endAt) {
    const nights = Math.round((Date.parse(b.endAt) - Date.parse(b.startAt)) / 86_400_000);
    return `${bakuShortDate(b.startAt)} – ${bakuDate(b.endAt)}${nights > 0 ? ` · ${nights} gecə` : ''}`;
  }
  return `${bakuDate(b.startAt)}, ${bakuTime(b.startAt)}`;
}

/** Server ləğv siyasətindən istifadəçiyə deyilən geri qaytarma məbləği. */
export function refundPreview(b: Pick<Booking, 'payment' | 'cancellation'>): { amountAzn: number; percent: number } {
  const p = b.payment;
  const paid = p && (p.status === 'succeeded' || p.status === 'partially_refunded') ? p.amountAzn : 0;
  const percent = b.cancellation.refundPercent;
  return { amountAzn: Math.round(paid * percent) / 100, percent };
}

/** "55 gün qalıb", "5 saat qalıb", "Başlayıb". */
export function timeLeftLabel(hoursLeft: number): string {
  if (hoursLeft <= 0) return 'Başlama vaxtı keçib';
  if (hoursLeft < 48) return `Başlanğıca ${hoursLeft} saat qalıb`;
  return `Başlanğıca ${Math.floor(hoursLeft / 24)} gün qalıb`;
}
