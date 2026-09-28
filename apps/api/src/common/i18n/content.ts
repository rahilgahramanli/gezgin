import type { Language } from '@prisma/client';
import { currentLang, type Lang } from './lang';

/**
 * `*_translations` cədvəlləri (məkan, region, marşrut) üçün Prisma filtri:
 * cari dil + az (fallback). az sorğusunda yalnız az sətri gəlir — nəticə əvvəlki kimidir.
 *   translations: { where: trWhere(), select: { lang: true, name: true } }
 */
export const trWhere = (lang: Lang = currentLang()): { lang: { in: Language[] } } => ({
  lang: { in: lang === 'az' ? ['az'] : ['az', lang] },
});

/** Tərcümə sətirlərindən cari dildəkini, yoxdursa az-ı seçir. */
export function pickTr<T extends { lang: string }>(rows: readonly T[] | undefined, lang: Lang = currentLang()): T | undefined {
  if (!rows?.length) return undefined;
  return rows.find((r) => r.lang === lang) ?? rows.find((r) => r.lang === 'az') ?? rows[0];
}
