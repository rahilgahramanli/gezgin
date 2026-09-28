import { BOOKING_EXTRAS } from '@gezgin/shared';
import { daysText, nightsText } from './format';
import { currentLang, pickText, type Lang } from './lang';
import { translateMessage } from './messages';

/**
 * Cavablarda yaranan qısa mətnlər — rezervasiya sətirləri, ləğv siyasəti,
 * kateqoriya və təcrübə adları. Bazada az saxlanılır, çevirmə koda görə olur.
 */

/** Kateqoriya adı — `categories` cədvəlində `name_en`, `name_ru` var; boşdursa az. */
export const categoryName = (
  c: { nameAz: string; nameEn?: string | null; nameRu?: string | null },
  lang: Lang = currentLang(),
): string => pickText({ az: c.nameAz, en: c.nameEn, ru: c.nameRu }, lang);

/** Prisma `select` — kateqoriya adının hər üç dili. */
export const CATEGORY_NAME_SELECT = { nameAz: true, nameEn: true, nameRu: true } as const;

/**
 * Təcrübə və tədbir başlığı — yalnız `title_en` sütunu var:
 * en üçün o (boşdursa az), ru üçün az (rus tərcüməsi hələ yoxdur).
 */
export const titleFor = (row: { titleAz: string; titleEn?: string | null }, lang: Lang = currentLang()): string =>
  pickText({ az: row.titleAz, en: row.titleEn }, lang);

// ─────────────────── rezervasiya ───────────────────

/** Ləğv siyasəti — ekran 53. Açar: başlanğıca qalan saat həddi. */
const CANCELLATION_LABELS: Record<number, { az: string; en: string; ru: string }> = {
  48: {
    az: '48 saatdan çox qalıb — tam geri qaytarma',
    en: 'More than 48 hours left — full refund',
    ru: 'Осталось больше 48 часов — полный возврат',
  },
  24: {
    az: '24–48 saat qalıb — 50% geri qaytarma',
    en: '24–48 hours left — 50% refund',
    ru: 'Осталось 24–48 часов — возврат 50%',
  },
  0: {
    az: '24 saatdan az qalıb — geri qaytarma yoxdur',
    en: 'Less than 24 hours left — no refund',
    ru: 'Осталось меньше 24 часов — без возврата',
  },
};

export const cancellationLabel = (hoursBefore: number, fallback: string, lang: Lang = currentLang()): string => {
  const l = CANCELLATION_LABELS[hoursBefore];
  return l ? l[lang] : fallback;
};

/** Otel paketi sətri: "2 gecə / 3 gün". */
export const packageLabel = (nights: number, days: number, lang: Lang = currentLang()): string =>
  `${nightsText(nights, lang)} / ${daysText(days, lang)}`;

/** Əlavə xidmətin adı — `@gezgin/shared` kataloqu. */
export function extraName(code: string, lang: Lang = currentLang()): string | null {
  const e = BOOKING_EXTRAS[code as keyof typeof BOOKING_EXTRAS];
  return e ? pickText({ az: e.nameAz, en: e.nameEn, ru: e.nameRu }, lang) : null;
}

/**
 * Qiymət sətrinin etiketi. `booking_items` sətri `name_az` saxlayır —
 * oxunanda `code`-a görə yenidən qurulur; tanınmayan kod olduğu kimi qalır.
 */
export function priceLineLabel(code: string, nameAz: string, lang: Lang = currentLang()): string {
  if (lang === 'az') return nameAz;
  if (code === 'adult') return lang === 'en' ? 'Adult' : 'Взрослый';
  if (code === 'child') return lang === 'en' ? 'Child (50% off)' : 'Ребёнок (скидка 50%)';
  if (code === 'package') {
    const m = nameAz.match(/^(\d+) gecə \/ (\d+) gün$/);
    return m ? packageLabel(Number(m[1]), Number(m[2]), lang) : nameAz;
  }
  return extraName(code, lang) ?? nameAz;
}

/** Ödəniş uğursuzluğunun səbəbi — provayderin az mesajı kataloqdan çevrilir. */
export const paymentFailureText = (message: string | null, lang: Lang = currentLang()): string | null =>
  message === null ? null : translateMessage(message, lang);

// ─────────────────── təcrübə ───────────────────

/** Ekran 17, 56 — "Qiymətə daxildir" seçimləri (kod → ad). */
export const INCLUSIONS: Record<string, { az: string; en: string; ru: string }> = {
  beledci: { az: 'Bələdçi', en: 'Guide', ru: 'Гид' },
  neqliyyat: { az: 'Nəqliyyat', en: 'Transport', ru: 'Транспорт' },
  'yerli-nahar': { az: 'Yerli nahar', en: 'Local lunch', ru: 'Местный обед' },
  sigorta: { az: 'Sığorta', en: 'Insurance', ru: 'Страховка' },
  materiallar: { az: 'Materiallar', en: 'Materials', ru: 'Материалы' },
  giris: { az: 'Giriş biletləri', en: 'Entrance tickets', ru: 'Входные билеты' },
  foto: { az: 'Foto çəkiliş', en: 'Photo shoot', ru: 'Фотосъёмка' },
};

export const inclusionName = (code: string, nameAz: string, lang: Lang = currentLang()): string =>
  lang === 'az' ? nameAz : (INCLUSIONS[code]?.[lang] ?? nameAz);

// ─────────────────── digər ───────────────────

type Tri = { az: string; en: string; ru: string };

/** Cavablarda birbaşa yaranan qısa sabit mətnlər. */
export const TEXTS = {
  free: { az: 'Pulsuz', en: 'Free', ru: 'Бесплатно' },
  all: { az: 'Hamısı', en: 'All', ru: 'Все' },
  post: { az: 'Paylaşım', en: 'Post', ru: 'Публикация' },
  booking: { az: 'Rezervasiya', en: 'Booking', ru: 'Бронирование' },
  note: { az: 'Qeyd', en: 'Note', ru: 'Заметка' },
  support: { az: 'GEZGIN Dəstək', en: 'GEZGIN Support', ru: 'Поддержка GEZGIN' },
  fromYourRegion: { az: 'Sənin regionundan', en: 'From your region', ru: 'Из вашего региона' },
  sharedInterests: { az: 'Ortaq maraqlar', en: 'Shared interests', ru: 'Общие интересы' },
  popularGezgin: { az: 'Populyar gezgin', en: 'Popular traveler', ru: 'Популярный путешественник' },
  azerbaijan: { az: 'Azərbaycan', en: 'Azerbaijan', ru: 'Азербайджан' },
  chatSoon: {
    az: 'Söhbət funksiyası Sprint 7-də açılacaq — hazırda sorğunuz qeydə alındı',
    en: 'Chat will be available soon — your request has been recorded',
    ru: 'Чат скоро станет доступен — ваш запрос зарегистрирован',
  },
} satisfies Record<string, Tri>;

export const text = (key: keyof typeof TEXTS, lang: Lang = currentLang()): string => TEXTS[key][lang];
