import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

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
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface Booking {
  publicId: string;
  code: string;
  status: 'awaiting_payment' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  startAt: string | null;
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
  /** Ödəniş məbləği `amountAzn`-dır — `paidAzn` adlı sahə yoxdur. */
  payment: {
    publicId: string;
    status: string;
    amountAzn: number;
    refundedAzn: number;
    paidAt: string | null;
    failureMessage: string | null;
  } | null;
}

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

/** Ekran 18 — qiymət hesabı. Rezervasiya yaratmır. */
export function useQuote(input: QuoteInput | null) {
  return useQuery({
    queryKey: ['quote', input],
    queryFn: () => api<Quote>('/bookings/quote', { method: 'POST', body: input }),
    enabled: input !== null,
  });
}

export const usePaymentMethods = () =>
  useQuery({ queryKey: ['payments', 'methods'], queryFn: () => api<PaymentMethod[]>('/payments/methods') });

export function useAddCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { number: string; expMonth: number; expYear: number; cvv: string; holderName?: string }) =>
      api<PaymentMethod>('/payments/methods', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payments', 'methods'] }),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuoteInput & { paymentMethodId?: string }) =>
      api<Booking>('/bookings', {
        method: 'POST',
        body,
        // Şəbəkə təkrarında ikinci rezervasiya yaranmasın deyə
        headers: { 'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

/**
 * Ödəniş. `paymentMethod` məcburidir — kart əvvəlcədən tokenləşdirilməlidir.
 * 3-D Secure lazım olsa cavabda `actionUrl` gəlir və `otp` ilə təsdiqlənir
 * (mock provayderdə kod: 123456).
 */
export function usePayBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, paymentMethod, otp }: { publicId: string; paymentMethod: string; otp?: string }) =>
      // Cavab birbaşa yenilənmiş Booking-dir (status: confirmed)
      api<Booking & { actionUrl?: string }>(`/bookings/${publicId}/pay`, {
        method: 'POST',
        body: { paymentMethod, ...(otp ? { otp } : {}) },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

/** `filter`: upcoming | past | cancelled — API-nin gözlədiyi ad budur. */
export const useBookings = (filter?: 'upcoming' | 'past' | 'cancelled') =>
  useQuery({
    queryKey: ['bookings', filter],
    queryFn: () => api<{ data: Booking[] }>(`/bookings${filter ? `?filter=${filter}` : ''}`),
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

export const useTicket = (publicId: string) =>
  useQuery({ queryKey: ['booking', publicId, 'ticket'], queryFn: () => api<Ticket>(`/bookings/${publicId}/ticket`) });
