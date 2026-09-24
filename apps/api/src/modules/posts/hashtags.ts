/**
 * `#gezgin #Xınalıq` → `['gezgin', 'xınalıq']`.
 *
 * Azərbaycan hərfləri (`ə`, `ı`, `ş`) `\p{L}` ilə tutulur; `az` lokalı `İ → i`
 * çevirməsini düzgün edir. Ayrı fayldadır ki, seed skripti Nest DI-ni
 * yükləmədən eyni qaydanı istifadə etsin.
 */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(found.map((t) => t.slice(1, 41).toLocaleLowerCase('az')))].slice(0, 10);
}
