import i18n, { tp } from '@/i18n';

/**
 * API enum dəyərlərinin insan oxunaqlı qarşılıqları — `common:labels.<qrup>.<kod>`.
 *
 * Xəritələr Proxy-dir: hər oxunuşda cari dilə görə tərcümə qaytarır, ona görə
 * `label(DIFFICULTY_LABEL, 'orta')` dil dəyişəndə də düzgün işləyir.
 */
function localized(group: string): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get: (_target, key) => {
      if (typeof key !== 'string') return undefined;
      const full = `common:labels.${group}.${key}`;
      return i18n.exists(full) ? i18n.t(full) : undefined;
    },
  });
}

/**
 * Təcrübə müddəti — API seed CSV-dəki azərbaycanca slug-ları qaytarır
 * (`2-saat`, `yarim-gun`), ingilis enum adlarını yox.
 */
export const DURATION_LABEL = localized('duration');
export const DIFFICULTY_LABEL = localized('difficulty');
export const TRIP_STATUS_LABEL = localized('tripStatus');
export const SEARCH_TYPE_LABEL = localized('searchType');
/** Biznes növü — API enum-u (`qonaq_evi`) və köhnə seed slug-ları (`qonaq-evi`). */
export const BUSINESS_TYPE_LABEL = localized('businessType');
/** Paket və xidmət kodları — seed CSV-lərindəki slug-lar. */
export const AMENITY_LABEL = localized('amenity');

/** Enum tanınmasa xam dəyəri qaytarır — ekranda boş yer qalmasın. */
export const label = (map: Record<string, string>, key: string | null | undefined): string =>
  (key && map[key]) || key || '';

/**
 * `3-saat` kimi sərbəst dəyərləri də oxunaqlı edir.
 * Seed məlumatında saat sayı dəyişkəndir, ona görə hər variantı
 * cədvələ yazmaq əvəzinə şablonu tanıyırıq.
 */
export function durationLabel(value: string | null | undefined): string {
  if (!value) return '';
  const known = DURATION_LABEL[value];
  if (known) return known;
  const hours = /^(\d+)-saat$/.exec(value);
  if (hours) return tp('common:labels.duration.hours', Number(hours[1]));
  const days = /^(\d+)-gun$/.exec(value);
  if (days) return tp('common:labels.duration.days', Number(days[1]));
  return value;
}
