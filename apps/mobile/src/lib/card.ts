/**
 * Kart formasının müştəri tərəfi yoxlaması.
 *
 * Server (`AddPaymentMethodDto`) eyni qaydaları yoxlayır, amma istifadəçi
 * səhvi sorğu göndərmədən, sahənin altında azərbaycanca görməlidir.
 * PAN heç yerdə saxlanılmır — yalnız `POST /payments/methods`-a gedir.
 */

export interface CardFormValues {
  number: string;
  /** "MM/YY" */
  expiry: string;
  cvc: string;
  holderName: string;
}

export type CardFormErrors = Partial<Record<keyof CardFormValues, string>>;

export interface CardPayload {
  number: string;
  expMonth: number;
  expYear: number;
  cvv: string;
  holderName?: string;
}

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** "4111111111111111" → "4111 1111 1111 1111" (maksimum 19 rəqəm). */
export function formatCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Yazılan rəqəmlərdən "MM/YY" qurur. Silmə zamanı "/" özü yox olur,
 * "1" yazanda ay kimi "1" qalır (10–12 üçün ikinci rəqəm gözlənilir).
 */
export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** "MM/YY" → { month, year } (year tam: 2029). Format pozulubsa `null`. */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { month: Number(m[1]), year: 2000 + Number(m[2]) };
}

/** Kartın markası — nömrənin başlanğıcına görə, yalnız göstərmək üçün. */
export function cardBrand(number: string): 'visa' | 'mastercard' | 'card' {
  const d = digitsOnly(number);
  if (d.startsWith('4')) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  return 'card';
}

const BRAND_LABEL: Record<string, string> = { visa: 'VISA', mastercard: 'Mastercard', card: 'Kart' };

export const brandLabel = (brand: string): string => BRAND_LABEL[brand] ?? brand.toUpperCase();

/** "VISA •••• 4242" — siyahılarda və accessibility etiketlərində eyni mətn. */
export const cardTitle = (card: { brand: string; last4: string }): string =>
  `${brandLabel(card.brand)} •••• ${card.last4}`;

/** "12/29" */
export const expiryLabel = (card: { expMonth: number | null; expYear: number | null }): string =>
  card.expMonth && card.expYear ? `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}` : '—';

/**
 * Bütün sahələri yoxlayır. Səhv yoxdursa `payload` qaytarılır.
 * `now` testlər üçündür — kartın müddəti cari aydan əvvəl bitməməlidir.
 */
export function validateCard(
  values: CardFormValues,
  now: Date = new Date(),
): { errors: CardFormErrors; payload: CardPayload | null } {
  const errors: CardFormErrors = {};
  const number = digitsOnly(values.number);
  const cvc = digitsOnly(values.cvc);

  if (!number) errors.number = 'Kart nömrəsini daxil edin';
  else if (number.length < 13 || number.length > 19) errors.number = 'Kart nömrəsi 13–19 rəqəm olmalıdır';

  const exp = parseExpiry(values.expiry);
  if (!values.expiry.trim()) {
    errors.expiry = 'Bitmə tarixini daxil edin';
  } else if (!exp) {
    errors.expiry = 'Tarixi AA/İİ formatında yazın';
  } else if (exp.month < 1 || exp.month > 12) {
    errors.expiry = 'Ay 01–12 arasında olmalıdır';
  } else {
    const thisMonth = now.getFullYear() * 12 + now.getMonth();
    const cardMonth = exp.year * 12 + (exp.month - 1);
    if (cardMonth < thisMonth) errors.expiry = 'Kartın müddəti bitib';
  }

  if (!cvc) errors.cvc = 'CVC kodunu daxil edin';
  else if (cvc.length < 3 || cvc.length > 4) errors.cvc = 'CVC 3–4 rəqəm olmalıdır';

  const holderName = values.holderName.trim();
  if (holderName && holderName.length < 2) errors.holderName = 'Ad ən azı 2 hərf olmalıdır';

  if (Object.keys(errors).length || !exp) return { errors, payload: null };
  return {
    errors,
    payload: {
      number,
      expMonth: exp.month,
      expYear: exp.year,
      cvv: cvc,
      ...(holderName ? { holderName } : {}),
    },
  };
}
