import { useRef, useState } from 'react';
import { ERROR_CODES } from '@gezgin/shared';
import { ApiError } from '@/api/client';
import i18n from '@/i18n';
import {
  needsPaymentAction, useCancelBooking, useCreateBooking, usePayBooking, type QuoteInput,
} from '@/api/hooks/booking';

/** Server açarı istifadəçiyə görə hash-ləyir — burada yalnız unikallıq lazımdır. */
export const newIdempotencyKey = (): string =>
  `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Server xətasının mətni (API onu özü tərcümə edir), əks halda şəbəkə xətası.
 * Susmaya görə mətn çağırış anında cari dildə götürülür.
 */
export function errorText(error: unknown, fallback: string = i18n.t('booking:errors.network')): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Parametrlər dəyişəndə köhnə ödənilməmiş rezervasiyanın ləğv səbəbi — daxili
 * qeyd (`cancelReason`), istifadəçiyə göstərilmir; server də `payment_timeout`
 * kimi dildən asılı olmayan kod yazır.
 */
const PARAMS_CHANGED_REASON = 'params_changed';

interface Options {
  /** Rezervasiya artıq varsa (Rezervasiya detalı → "Ödənişi tamamla") yalnız ödəniş edilir. */
  bookingId?: string;
  onConfirmed: (publicId: string) => void;
  /** Tutum xətası ("Bu tarixdə yalnız 1 yer qalıb") — boş yerləri təzələmək üçün. */
  onCapacityError?: () => void;
}

interface Session {
  /** Bu ekran sessiyasının `Idempotency-Key`-i. */
  key: string;
  /** Açar hansı parametrlərlə işlədilib — dəyişəndə yeni açar lazımdır. */
  signature: string | null;
  bookingId: string | null;
}

/**
 * Ödəniş axını (ekran 18, 49, 53):
 *
 *  1. Rezervasiya BİR DƏFƏ yaradılır — sabit `Idempotency-Key` ilə. Əvvəl hər
 *     toxunuş təsadüfi açarla yeni rezervasiya yaradırdı.
 *  2. `POST /bookings/:id/pay`. Kart rədd olunsa (400 PAYMENT_FAILED) xəta
 *     göstərilir, istifadəçi eyni və ya başqa kartla EYNİ rezervasiyanı ödəyir.
 *  3. `payment.status === 'requires_action'` → 3-D Secure kodu soruşulur və
 *     `otp` ilə təkrar göndərilir; səhv kod yenə `requires_action` qaytarır.
 *
 * İstifadəçi ödənişdən sonra tarixi/nəfər sayını dəyişsə, köhnə ödənilməmiş
 * rezervasiya ləğv edilir (yer boşalsın) və yenisi yeni açarla yaradılır.
 */
export function useCheckout({ bookingId: existingId, onConfirmed, onCapacityError }: Options) {
  const create = useCreateBooking();
  const pay = usePayBooking();
  const cancel = useCancelBooking();
  const session = useRef<Session>({ key: newIdempotencyKey(), signature: null, bookingId: existingId ?? null });

  const [error, setError] = useState<string | null>(null);
  /**
   * Bu sessiyada yaradılmış, hələ ödənilməmiş rezervasiyanın parametrləri.
   * Onun tutduğu yerlər boş yer sayından çıxılıb — ekran bunu nəzərə alır ki,
   * öz rezervasiyamız slotu "dolu" göstərib seçimi dəyişdirməsin.
   */
  const [pending, setPending] = useState<QuoteInput | null>(null);
  /**
   * 3-D Secure addımı açıqdır; `wrong` — əvvəlki kod qəbul olunmayıb,
   * `attempt` hər cavabda artır (sahə təmizlənsin deyə).
   */
  const [otp, setOtp] = useState<{ methodId: string; wrong: boolean; attempt: number } | null>(null);

  const busy = create.isPending || pay.isPending || cancel.isPending;

  const fail = (e: unknown) => {
    setOtp(null);
    const api = e instanceof ApiError ? e : null;
    if (api?.code === ERROR_CODES.BOOKING_SLOT_TAKEN) onCapacityError?.();
    // Rezervasiya artıq ödənilə bilmir (ödəniş vaxtı bitib və s.) — növbəti cəhd yenisini yaradır
    if (api?.code === ERROR_CODES.CONFLICT && !existingId) {
      session.current = { key: newIdempotencyKey(), signature: null, bookingId: null };
      setPending(null);
    }
    setError(errorText(e));
  };

  const payOnce = async (publicId: string, methodId: string, code?: string) => {
    const res = await pay.mutateAsync({ publicId, paymentMethod: methodId, otp: code });
    if (res.status === 'confirmed' || res.status === 'completed') {
      setOtp(null);
      onConfirmed(publicId);
      return;
    }
    if (needsPaymentAction(res)) {
      setOtp((prev) => ({ methodId, wrong: code !== undefined, attempt: (prev?.attempt ?? 0) + 1 }));
      return;
    }
    setOtp(null);
    setError(res.payment && 'failureMessage' in res.payment && res.payment.failureMessage
      ? res.payment.failureMessage
      : i18n.t('booking:errors.paymentIncomplete'));
  };

  /**
   * Yeni rezervasiya + ödəniş. `signature` verilməsə `input`-un özü götürülür;
   * otel ekranı giriş vaxtını hər toxunuşda yenidən hesablayır, ona görə öz
   * sabit imzasını ötürür.
   */
  const submit = async (input: QuoteInput, methodId: string, signature = JSON.stringify(input)) => {
    setError(null);
    try {
      const s = session.current;
      if (s.signature !== null && s.signature !== signature) {
        if (s.bookingId) {
          // Ləğv GÖZLƏNİLİR: köhnə rezervasiya yerləri buraxmamış yenisi yaradılsa dolu
          // tarixdə "yalnız 1 yer qalıb" alınırdı. Ləğv alınmasa da (vaxtı bitib,
          // artıq ləğv olunub) yer onsuz da boşdur — axın davam edir.
          await cancel.mutateAsync({ publicId: s.bookingId, reason: PARAMS_CHANGED_REASON }).catch(() => undefined);
        }
        session.current = { key: newIdempotencyKey(), signature: null, bookingId: null };
        setPending(null);
      }
      session.current.signature = signature;

      let id = session.current.bookingId;
      if (!id) {
        const booking = await create.mutateAsync({ body: input, idempotencyKey: session.current.key });
        id = booking.publicId;
        session.current.bookingId = id;
        setPending(booking.status === 'awaiting_payment' || booking.status === 'pending' ? input : null);
        if (booking.status === 'confirmed') {
          onConfirmed(id);
          return;
        }
      }
      await payOnce(id, methodId);
    } catch (e) {
      fail(e);
    }
  };

  /** Mövcud rezervasiyanı ödəyir (detal ekranı). */
  const payExisting = async (methodId: string) => {
    const id = session.current.bookingId;
    if (!id) return;
    setError(null);
    try {
      await payOnce(id, methodId);
    } catch (e) {
      fail(e);
    }
  };

  const submitOtp = async (code: string) => {
    const id = session.current.bookingId;
    if (!id || !otp) return;
    setError(null);
    try {
      await payOnce(id, otp.methodId, code);
    } catch (e) {
      fail(e);
    }
  };

  const cancelOtp = () => {
    setOtp(null);
    setError(i18n.t('booking:errors.otpCancelled'));
  };

  return { busy, error, setError, otp, pending, submit, payExisting, submitOtp, cancelOtp };
}
