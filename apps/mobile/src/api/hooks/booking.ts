import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { meKeys } from '@/api/hooks/me';

export interface QuoteLine {
  code: string;
  label: string;
  quantity: number;
  unitAzn: number;
  totalAzn: number;
}

export interface Quote {
  type: string;
  title: string;
  adults: number;
  children: number;
  lines: QuoteLine[];
  subtotalAzn: number;
  extrasAzn: number;
  serviceFeeAzn: number;
  totalAzn: number;
  /** Otel paketində gecə sayı, təcrübədə 0. */
  nights: number;
  /** Komissiya yalnız təcrübədə var — otel paketində `null` gəlir. */
  commission: { expertEarnsAzn: number; platformFeeAzn: number; rate: number } | null;
  rewards: { bookingXp: number; experienceXp: number };
}

export interface PaymentMethod {
  publicId: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
  isDefault: boolean;
  /** Server hesablayır — müddəti bitmiş kartla ödəniş rədd olunur. */
  isExpired: boolean;
}

/** `POST /payments/methods` qısa forma qaytarır (tarix və ad yoxdur). */
export interface AddedCard {
  publicId: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

/** `refunded` — ləğv edilib və pul qaytarılıb; siyahıda "Ləğv edilmiş" tabına düşür. */
export type BookingStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';

export type PaymentStatus =
  | 'created'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface BookingPayment {
  publicId: string;
  status: PaymentStatus;
  amountAzn: number;
  refundedAzn: number;
  paidAt: string | null;
  failureMessage: string | null;
}

/** Ləğv siyasəti — server başlanğıca qalan saata görə hesablayır. */
export interface BookingCancellation {
  canCancel: boolean;
  hoursLeft: number;
  refundPercent: number;
  label: string;
}

export interface Booking {
  publicId: string;
  code: string;
  status: BookingStatus;
  type: 'experience' | 'business_package';
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  startAt: string | null;
  /** Otel paketində çıxış tarixi, təcrübədə `null`. */
  endAt: string | null;
  adults: number;
  children: number;
  /** Qiymət `pricing` içindədir — API cavabının formasıdır. */
  pricing: {
    lines: QuoteLine[];
    subtotalAzn: number;
    extrasAzn: number;
    serviceFeeAzn: number;
    totalAzn: number;
  };
  /** Ödəniş məbləği `amountAzn`-dır — `paidAzn` adlı sahə yoxdur. Son cəhd göstərilir. */
  payment: BookingPayment | null;
  cancellation: BookingCancellation;
}

/** 3-D Secure lazım olanda `pay` cavabında `payment` bu formada gəlir. */
export interface PaymentAction {
  status: 'requires_action';
  actionUrl: string;
  paymentPublicId: string;
}

export type PayResponse = Omit<Booking, 'payment'> & { payment: BookingPayment | PaymentAction | null };

export const needsPaymentAction = (res: PayResponse): boolean => res.payment?.status === 'requires_action';

export interface Ticket {
  code: string;
  /** QR kodun məzmunu: `GEZGIN:<kod>:<publicId>` */
  qrPayload: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  guests: { adults: number; children: number };
  totalAzn: number;
  status: string;
}

export interface CancelResult {
  cancelled: true;
  policy: { hoursBefore: number; refundPercent: number; label: string };
  refund: { refunded: boolean; amountAzn: number };
}

export interface QuoteInput {
  type: 'experience' | 'business_package';
  /** Təcrübə slug-ı və ya paketin `publicId`-si. */
  target: string;
  adults: number;
  children?: number;
  /** Təcrübə üçün tarix. */
  slotId?: number;
  /** Otel paketi üçün giriş tarixi (ISO) — ekran 49. */
  startAt?: string;
  extras?: string[];
}

export type BookingFilter = 'upcoming' | 'past' | 'cancelled';

export interface BookingList {
  /** Tab sayğacları siyahı ilə eyni şərtlərlə sayılır. */
  counts: Record<BookingFilter, number>;
  summary: { totalSpentAzn: number; bookingCount: number };
  data: Booking[];
  nextOffset: number | null;
}

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (filter?: BookingFilter) => ['bookings', filter] as const,
  detail: (publicId: string) => ['booking', publicId] as const,
  ticket: (publicId: string) => ['booking', publicId, 'ticket'] as const,
  methods: ['payments', 'methods'] as const,
};

/**
 * Rezervasiya vəziyyəti dəyişəndə (ödəniş, ləğv) təzələnməli olanlar:
 * siyahılar və sayğaclar, detal, boş yerlər, həmçinin XP/Score (+50 XP verilir
 * və ya geri alınır).
 */
function invalidateAfterBookingChange(qc: QueryClient, publicId: string): void {
  void qc.invalidateQueries({ queryKey: bookingKeys.all });
  void qc.invalidateQueries({ queryKey: bookingKeys.detail(publicId) });
  void qc.invalidateQueries({ queryKey: ['availability'] });
  void qc.invalidateQueries({ queryKey: ['experience'] });
  void qc.invalidateQueries({ queryKey: meKeys.profile, exact: true });
  void qc.invalidateQueries({ queryKey: meKeys.stats });
  void qc.invalidateQueries({ queryKey: meKeys.score });
}

/** Ekran 18 — qiymət hesabı. Rezervasiya yaratmır. */
export function useQuote(input: QuoteInput | null) {
  return useQuery({
    queryKey: ['quote', input],
    queryFn: () => api<Quote>('/bookings/quote', { method: 'POST', body: input }),
    enabled: input !== null,
    // Nəfər sayı dəyişəndə düymədəki məbləğ "Bron et"-ə qədər sıçramasın;
    // köhnə rəqəm `isPlaceholderData` müddətində ödənişə buraxılmır
    placeholderData: keepPreviousData,
    // 400 (məs. keçmiş tarix) təkrarlamaqla düzəlmir
    retry: false,
  });
}

export const usePaymentMethods = (enabled = true) =>
  useQuery({
    queryKey: bookingKeys.methods,
    queryFn: () => api<PaymentMethod[]>('/payments/methods'),
    enabled,
  });

export function useAddCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { number: string; expMonth: number; expYear: number; cvv: string; holderName?: string }) =>
      api<AddedCard>('/payments/methods', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: bookingKeys.methods }),
  });
}

export function useSetDefaultCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) =>
      api<PaymentMethod[]>(`/payments/methods/${publicId}/default`, { method: 'POST' }),
    onSuccess: (methods) => qc.setQueryData(bookingKeys.methods, methods),
    onSettled: () => void qc.invalidateQueries({ queryKey: bookingKeys.methods }),
  });
}

export function useRemoveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api<{ deleted: true }>(`/payments/methods/${publicId}`, { method: 'DELETE' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: bookingKeys.methods }),
  });
}

/**
 * Rezervasiya yaradır. `idempotencyKey` ekran sessiyası boyu sabit qalmalıdır —
 * təkrar toxunuş və ya şəbəkə təkrarı ikinci rezervasiya yaratmasın (server eyni
 * açarla ilk yaradılanı qaytarır).
 */
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: QuoteInput; idempotencyKey: string }) =>
      api<Booking>('/bookings', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bookingKeys.all });
      void qc.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

/**
 * Ödəniş. Uğursuz kart 400 `PAYMENT_FAILED` qaytarır — rezervasiya ödənilməmiş
 * qalır və eyni rezervasiya başqa kartla yenidən ödənilə bilər.
 * 3-D Secure lazım olsa cavabda `payment.status === 'requires_action'` gəlir;
 * `otp` ilə təkrar göndərilir (mock provayderdə kod: 123456), səhv kod yenə
 * `requires_action` qaytarır.
 */
export function usePayBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, paymentMethod, otp }: { publicId: string; paymentMethod: string; otp?: string }) =>
      api<PayResponse>(`/bookings/${publicId}/pay`, {
        method: 'POST',
        body: { paymentMethod, ...(otp ? { otp } : {}) },
      }),
    onSettled: (_data, _error, vars) => invalidateAfterBookingChange(qc, vars.publicId),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason?: string }) =>
      api<CancelResult>(`/bookings/${publicId}/cancel`, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
    onSettled: (_data, _error, vars) => invalidateAfterBookingChange(qc, vars.publicId),
  });
}

/** `filter`: upcoming | past | cancelled — API-nin gözlədiyi ad budur. */
export const useBookings = (filter?: BookingFilter, enabled = true) =>
  useQuery({
    queryKey: bookingKeys.list(filter),
    queryFn: () => api<BookingList>(`/bookings${filter ? `?filter=${filter}` : ''}`),
    enabled,
  });

export const useBooking = (publicId: string) =>
  useQuery({
    queryKey: bookingKeys.detail(publicId),
    queryFn: () => api<Booking>(`/bookings/${publicId}`),
  });

export interface Slot {
  slotId: number;
  startAt: string;
  seatsLeft: number;
  capacity: number;
  isFull: boolean;
  priceAzn: number;
}

/** Ekran 18 tarix seçici. */
/** 90 gün — expertlər tarixləri çox vaxt bir neçə ay irəli açır. */
export const useAvailability = (slug: string, days = 90) =>
  useQuery({
    queryKey: ['availability', slug, days],
    queryFn: () => api<{ defaultPriceAzn: number; slots: Slot[] }>(`/experiences/${slug}/availability?days=${days}`),
  });

/** Bilet yalnız təsdiqlənmiş/tamamlanmış rezervasiya üçündür — digərlərində 400 qaytarır. */
export const useTicket = (publicId: string, enabled = true) =>
  useQuery({
    queryKey: bookingKeys.ticket(publicId),
    queryFn: () => api<Ticket>(`/bookings/${publicId}/ticket`),
    enabled,
  });
