/** Rollar — ekran 21, 22, 36, 55. */
export const USER_ROLES = ['gezgin', 'local_expert', 'business', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LANGUAGES = ['az', 'en', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'az';

/** Local Expert 80% alır, platforma 20% — ekran 12, 17, 56. */
export const PLATFORM_COMMISSION_RATE = 0.2;
export const EXPERT_PAYOUT_RATE = 1 - PLATFORM_COMMISSION_RATE;

export const CURRENCY = 'AZN' as const;

/** Səhifələmə — cursor əsaslı. */
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;

/** Xəta kodları — mobil tərəf bunlara görə tərcümə göstərir. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  BOOKING_SLOT_TAKEN: 'BOOKING_SLOT_TAKEN',
  BOOKING_NOT_CANCELLABLE: 'BOOKING_NOT_CANCELLABLE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA: 'UNSUPPORTED_MEDIA',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Media limitləri. */
export const MEDIA = {
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  imageMime: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  videoMime: ['video/mp4', 'video/quicktime'],
  sizes: { thumb: 200, card: 800, full: 1600 },
} as const;

/**
 * Rezervasiya əlavə xidmətləri — ekran 18 və 49.
 * Burada saxlanılır ki, mobil ekran qiyməti seçimdən ƏVVƏL göstərə bilsin;
 * API `QuoteDto.extras` yoxlamasında da eyni siyahını istifadə edir.
 * `scope`: təcrübədə nəfər başına, otel paketində rezervasiya başına.
 */
export const BOOKING_EXTRAS = {
  transfer: { nameAz: 'Transfer', hintAz: 'Gediş-gəliş, rahat mikroavtobus', priceAzn: 25 },
  sigorta: { nameAz: 'Səyahət sığortası', hintAz: 'Bütün səyahət müddəti', priceAzn: 5 },
  spa: { nameAz: 'Spa paketi', hintAz: 'Sauna, hovuz, 45 dəq masaj', priceAzn: 60 },
  'ferdi-beledci': { nameAz: 'Fərdi bələdçi', hintAz: 'Yerli bələdçi müşayiəti', priceAzn: 40 },
} as const;
export type BookingExtraCode = keyof typeof BOOKING_EXTRAS;

/**
 * Ekran 27 "Səyahətin necə keçdi?" çipləri. Rəyin `tags` sahəsində slug kimi
 * saxlanılır; API yazanda bu siyahı ilə yoxlayır, mobil eyni etiketi göstərir.
 */
export const REVIEW_TAGS = {
  tebiet: 'Təbiət 🌿',
  'samimi-insanlar': 'Səmimi insanlar',
  'yol-cetindir': 'Yol çətindir',
  'yerli-metbex': 'Yerli mətbəx',
  'usaqla-uygun': 'Uşaqla uyğun',
  fotogenik: 'Fotogenik',
} as const;
export type ReviewTag = keyof typeof REVIEW_TAGS;
