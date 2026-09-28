import { TIERS, XP_RULES, type Tier } from '@gezgin/shared';
import { currentLang, pickText, type Lang } from './lang';

/**
 * Tier, XP qaydası və badge adlarının tərcüməsi.
 * Tier və XP qaydaları `@gezgin/shared`-dədir (mobil də eyni mətni göstərə bilsin);
 * badge-lərin bazada yalnız `name_en` sütunu var — təsvir və rus adı burada, slug üzrə.
 */

/** Tier adı — `Tier` obyekti, kodu və ya az adı ilə (bildirişdə yalnız az ad qalır). */
export function tierName(tier: Tier | string, lang: Lang = currentLang()): string {
  const t = typeof tier === 'string' ? TIERS.find((x) => x.code === tier || x.nameAz === tier) : tier;
  if (!t) return String(tier);
  return pickText({ az: t.nameAz, en: t.nameEn, ru: t.nameRu }, lang);
}

/** `levels` cədvəlinin sətri — az üçün bazadakı ad, digər dillər `@gezgin/shared`-dən. */
export function tierNameFromRow(
  row: { tierCode: string; tierNameAz: string; tierNameEn?: string | null },
  lang: Lang = currentLang(),
): string {
  if (lang === 'az') return row.tierNameAz;
  const t = TIERS.find((x) => x.code === row.tierCode);
  if (t) return lang === 'en' ? t.nameEn : t.nameRu;
  return (lang === 'en' && row.tierNameEn) || row.tierNameAz;
}

export function xpRuleName(action: string, lang: Lang = currentLang()): string {
  const r = XP_RULES[action as keyof typeof XP_RULES];
  return r ? pickText({ az: r.nameAz, en: r.nameEn, ru: r.nameRu }, lang) : action;
}

/**
 * XP tarixçəsinin qeydi. Sistem qeydləri tərcümə olunur; qalanı (məkan adı,
 * paylaşımın mətni, rezervasiya kodu) olduğu kimi qalır.
 */
export function xpNoteText(note: string | null, lang: Lang = currentLang()): string | null {
  if (note === null || lang === 'az') return note;
  if (note === 'Gündəlik limit dolub') return lang === 'en' ? 'Daily limit reached' : 'Дневной лимит исчерпан';
  if (note === 'XP geri alındı') return lang === 'en' ? 'XP revoked' : 'XP отозваны';
  const cancelled = note.match(/^(\S+) ləğv edildi$/);
  if (cancelled) return lang === 'en' ? `${cancelled[1]} cancelled` : `${cancelled[1]} отменено`;
  return note;
}

interface BadgeText {
  nameAz: string;
  nameEn: string;
  nameRu: string;
  descriptionAz: string;
  descriptionEn: string;
  descriptionRu: string;
}

/** seed/config-badges.csv ilə eyni slug-lar. Yeni badge əlavə olunanda buraya da yazın. */
export const BADGE_TEXTS: Record<string, BadgeText> = {
  'ilk-addim': {
    nameAz: 'İlk Addım', nameEn: 'First Step', nameRu: 'Первый шаг',
    descriptionAz: 'İlk check-in', descriptionEn: 'Your first check-in', descriptionRu: 'Первый чек-ин',
  },
  'ilk-zirve': {
    nameAz: 'İlk Zirvə', nameEn: 'First Summit', nameRu: 'Первая вершина',
    descriptionAz: '10 məkan kəşf et', descriptionEn: 'Discover 10 places', descriptionRu: 'Откройте 10 мест',
  },
  'region-kesfcisi': {
    nameAz: 'Region Kəşfçisi', nameEn: 'Region Explorer', nameRu: 'Исследователь регионов',
    descriptionAz: '5 region kəşf et', descriptionEn: 'Discover 5 regions', descriptionRu: 'Откройте 5 регионов',
  },
  fotoqu: {
    nameAz: 'Fotoqu', nameEn: 'Photographer', nameRu: 'Фотограф',
    descriptionAz: '50 foto və ya video paylaşımı et', descriptionEn: 'Share 50 photo or video posts', descriptionRu: 'Опубликуйте 50 фото или видео',
  },
  marsrutcu: {
    nameAz: 'Marşrutçu', nameEn: 'Route Maker', nameRu: 'Создатель маршрутов',
    descriptionAz: '5 marşrut yarat', descriptionEn: 'Create 5 routes', descriptionRu: 'Создайте 5 маршрутов',
  },
  tecrubeci: {
    nameAz: 'Təcrübəçi', nameEn: 'Experiencer', nameRu: 'Знаток впечатлений',
    descriptionAz: '20 təcrübə yaşa', descriptionEn: 'Enjoy 20 experiences', descriptionRu: 'Посетите 20 впечатлений',
  },
  efsane: {
    nameAz: 'Əfsanə', nameEn: 'Legend', nameRu: 'Легенда',
    descriptionAz: 'Level 20-yə çat', descriptionEn: 'Reach Level 20', descriptionRu: 'Достигните Уровня 20',
  },
  reyci: {
    nameAz: 'Rəyçi', nameEn: 'Reviewer', nameRu: 'Рецензент',
    descriptionAz: '25 rəy yaz', descriptionEn: 'Write 25 reviews', descriptionRu: 'Напишите 25 отзывов',
  },
};

interface BadgeRow {
  slug: string;
  nameAz: string;
  nameEn?: string | null;
  descriptionAz: string | null;
}

/**
 * Badge-in adı və təsviri cari dildə. az üçün bazadakı mətn olduğu kimi qalır;
 * cədvəldə olmayan badge üçün en adı bazadan (`name_en`), qalanı az-dır.
 */
export function badgeText(b: BadgeRow, lang: Lang = currentLang()): { name: string; description: string | null } {
  if (lang === 'az') return { name: b.nameAz, description: b.descriptionAz };
  const t = BADGE_TEXTS[b.slug];
  if (!t) return { name: (lang === 'en' && b.nameEn) || b.nameAz, description: b.descriptionAz };
  return {
    name: lang === 'en' ? t.nameEn : t.nameRu,
    description: b.descriptionAz === null ? null : lang === 'en' ? t.descriptionEn : t.descriptionRu,
  };
}

/** Bildiriş başlığındakı az adına görə badge — "Yeni badge: İlk Addım 🎉". */
export const badgeByAzName = (nameAz: string): BadgeText | undefined =>
  Object.values(BADGE_TEXTS).find((b) => b.nameAz === nameAz);

export const badgeByAzDescription = (descriptionAz: string): BadgeText | undefined =>
  Object.values(BADGE_TEXTS).find((b) => b.descriptionAz === descriptionAz);
