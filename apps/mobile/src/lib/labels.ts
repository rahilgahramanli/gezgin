/** API enum dəyərlərinin insan oxunaqlı qarşılıqları. */

/**
 * Təcrübə müddəti — API seed CSV-dəki azərbaycanca slug-ları qaytarır
 * (`2-saat`, `yarim-gun`), ingilis enum adlarını yox.
 */
export const DURATION_LABEL: Record<string, string> = {
  'yarim-gun': 'Yarım gün',
  '1-gun': '1 gün',
  '2-gun': '2 gün',
  'bir-nece-gun': 'Bir neçə gün',
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  asan: 'Asan',
  orta: 'Orta',
  cetin: 'Çətin',
};

export const TRIP_STATUS_LABEL: Record<string, string> = {
  planned: 'Planlanıb',
  active: 'Aktiv',
  completed: 'Tamamlandı',
  cancelled: 'Ləğv edildi',
};

export const SEARCH_TYPE_LABEL: Record<string, string> = {
  place: 'Yer',
  route: 'Marşrut',
  experience: 'Təcrübə',
  event: 'Tədbir',
  user: 'Gezgin',
};

/** Paket və xidmət kodları — seed CSV-lərindəki slug-lar. */
export const AMENITY_LABEL: Record<string, string> = {
  // xidmətlər
  spa: 'Spa',
  hovuz: 'Hovuz',
  restoran: 'Restoran',
  transfer: 'Transfer',
  konfrans: 'Konfrans zalı',
  ski: 'Xizək',
  'yerli-metbex': 'Yerli mətbəx',
  beledci: 'Bələdçi',
  // paketə daxil olanlar
  yerlesme: 'Yerləşmə',
  'sehar-yemeyi': 'Səhər yeməyi',
  'tam-pansion': 'Tam pansion',
  'ski-pass': 'Ski-pass',
  neqliyyat: 'Nəqliyyat',
  'yerli-nahar': 'Yerli nahar',
  sigorta: 'Sığorta',
  materiallar: 'Materiallar',
};

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
  if (hours) return `${hours[1]} saat`;
  const days = /^(\d+)-gun$/.exec(value);
  if (days) return `${days[1]} gün`;
  return value;
}
