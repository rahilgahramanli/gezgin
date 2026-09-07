/**
 * Azərbaycan dili üçün axtarış normalizasiyası.
 *
 * MySQL tərəfindəki `search_text` generated sütunu ilə EYNİ qaydanı tətbiq edir
 * (bax: prisma/migrations/*_search_normalization). İkisi bir-birinə uyğun
 * qalmalıdır — biri dəyişəndə digəri də dəyişməlidir.
 *
 * Niyə lazımdır: utf8mb4_0900_ai_ci `ş→s`, `ğ→g`, `ö→o` uyğunlaşdırır, amma
 * `ə` (U+0259) və `ı` (U+0131) müstəqil hərflərdir — `e` və `i` ilə uyğunlaşmır.
 */
export function foldAz(input: string): string {
  return input
    .toLowerCase()
    .replace(/ə/g, 'e') // ə
    .replace(/ı/g, 'i') // ı
    .replace(/̇/g, ''); // İ → i + birləşən nöqtə (toLowerCase-dən sonra)
}

/** FULLTEXT BOOLEAN MODE-da xüsusi məna daşıyan simvollar. */
const BOOLEAN_OPERATORS = /[+\-><()~*"@]/g;

/**
 * İstifadəçi sorğusunu BOOLEAN MODE ifadəsinə çevirir.
 *
 * Dil şəkilçili olduğu üçün (kənd → kəndi, kənddə) hər sözə prefiks
 * ulduzu qoyulur. `innodb_ft_min_token_size = 3` olduğuna görə 3 hərfdən
 * qısa sözlər atılır — əks halda nəticə boş qayıdır.
 */
export function toBooleanQuery(raw: string, { requireAll = false } = {}): string | null {
  const words = foldAz(raw)
    .replace(BOOLEAN_OPERATORS, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    .slice(0, 8);

  if (!words.length) return null;
  return words.map((w) => `${requireAll ? '+' : ''}${w}*`).join(' ');
}

/** Sorğu FULLTEXT üçün çox qısadırsa (məs. "AZ"), LIKE-a keçirik. */
export function isTooShortForFulltext(raw: string): boolean {
  return toBooleanQuery(raw) === null && foldAz(raw).trim().length > 0;
}

export function toLikePattern(raw: string): string {
  return `%${foldAz(raw).replace(/[%_\\]/g, '\\$&')}%`;
}
