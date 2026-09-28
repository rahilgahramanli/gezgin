import type { Booking } from '@/api/hooks/booking';
import i18n, { tp } from '@/i18n';
import { bakuDate, bakuShortDate, bakuTime } from '@/lib/time';

type Tone = 'teal' | 'gold' | 'gray' | 'brown';

/** Status rəngi; mətn `booking:status.booking.<status>`-dan, oxunanda cari dildə. */
const BOOKING_STATUS_TONE: Record<string, Tone> = {
  confirmed: 'teal',
  awaiting_payment: 'gold',
  pending: 'gold',
  completed: 'gray',
  cancelled: 'gray',
  // Ləğv edilib və pul karta qaytarılıb
  refunded: 'brown',
};

/** Naməlum status xam dəyəri ilə göstərilir — ekranda boş yer qalmasın. */
const statusText = (group: 'booking' | 'payment', status: string): string => {
  const key = `booking:status.${group}.${status}`;
  return i18n.exists(key) ? i18n.t(key) : status;
};

export const bookingStatus = (status: string): { label: string; tone: Tone } => ({
  label: statusText('booking', status),
  tone: BOOKING_STATUS_TONE[status] ?? 'gray',
});

/** Ödəniş statusu: "Ödənilib", "Bank təsdiqi gözlənilir"… */
export const paymentStatusLabel = (status: string): string => statusText('payment', status);

/** Ödənilməmiş rezervasiya — "Ödənişi tamamla" göstərilir. */
export const isPayable = (b: Pick<Booking, 'status'>): boolean =>
  b.status === 'awaiting_payment' || b.status === 'pending';

/** "2 böyük + 1 uşaq" */
export const guestsLabel = (b: { adults: number; children: number }): string =>
  `${tp('booking:status.adults', b.adults)}${b.children ? ` + ${tp('booking:status.children', b.children)}` : ''}`;

/**
 * Siyahı kartındakı tarix sətri (Bakı vaxtı):
 * təcrübə — "22 noy 2026, 13:00", otel — "5 – 7 iyl 2026 · 2 gecə".
 */
export function bookingWhen(b: Pick<Booking, 'startAt' | 'endAt'>): string {
  if (!b.startAt) return i18n.t('booking:shared.noDate');
  if (b.endAt) {
    const nights = Math.round((Date.parse(b.endAt) - Date.parse(b.startAt)) / 86_400_000);
    return `${bakuShortDate(b.startAt)} – ${bakuDate(b.endAt)}${nights > 0 ? ` · ${tp('booking:shared.nights', nights)}` : ''}`;
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

/** "Başlanğıca 55 gün qalıb", "Başlanğıca 5 saat qalıb", "Başlama vaxtı keçib". */
export function timeLeftLabel(hoursLeft: number): string {
  if (hoursLeft <= 0) return i18n.t('booking:status.started');
  if (hoursLeft < 48) return tp('booking:status.hoursLeft', hoursLeft);
  return tp('booking:status.daysLeft', Math.floor(hoursLeft / 24));
}
