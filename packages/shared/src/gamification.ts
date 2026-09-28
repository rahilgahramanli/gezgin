/**
 * Gezgin Score, XP, level və badge qaydaları.
 *
 * Level sistemi TƏSDİQLƏNİB (31.08.2026):
 * 20 nömrəli level, prezentasiyanın slayd 8-dəki 5 adı isə TIER kimi
 * level aralıqlarına bağlanır. Beləliklə slayd 8 (5 səviyyə) və tətbiq
 * ekranları (Aysel Level 12 "Kəşf edən", badge "Əfsanə — Level 20") uyğunlaşır.
 * Mənbə: seed/config-levels.csv
 */

export type TierCode = 'baslangic' | 'kesf_eden' | 'seyyah' | 'kesfci' | 'gezgin';

export interface Tier {
  code: TierCode;
  nameAz: string;
  nameEn: string;
  nameRu: string;
  fromLevel: number;
  toLevel: number;
}

export const TIERS: readonly Tier[] = [
  { code: 'baslangic', nameAz: 'Başlanğıc', nameEn: 'Beginner', nameRu: 'Новичок', fromLevel: 1, toLevel: 5 },
  { code: 'kesf_eden', nameAz: 'Kəşf edən', nameEn: 'Explorer', nameRu: 'Исследователь', fromLevel: 6, toLevel: 12 },
  { code: 'seyyah', nameAz: 'Səyyah', nameEn: 'Traveler', nameRu: 'Путешественник', fromLevel: 13, toLevel: 17 },
  { code: 'kesfci', nameAz: 'Kəşfçi', nameEn: 'Discoverer', nameRu: 'Первооткрыватель', fromLevel: 18, toLevel: 19 },
  { code: 'gezgin', nameAz: 'Gezgin', nameEn: 'Gezgin', nameRu: 'Gezgin', fromLevel: 20, toLevel: 20 },
] as const;

/** İndeks = level - 1. Dəyər = həmin levelə çatmaq üçün lazım olan ümumi XP. */
export const LEVEL_XP: readonly number[] = [
  0, 150, 350, 600, 900, 1300, 1800, 2400, 3100, 3900,
  4800, 5800, 6900, 8100, 9400, 10800, 12300, 13900, 15600, 17400,
] as const;

export const MAX_LEVEL = LEVEL_XP.length;

export function tierForLevel(level: number): Tier {
  return TIERS.find((t) => level >= t.fromLevel && level <= t.toLevel) ?? TIERS[TIERS.length - 1];
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (totalXp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

export interface LevelProgress {
  level: number;
  tier: Tier;
  /** Cari level daxilində qazanılan XP (ekran 29-dakı "550") */
  xpInLevel: number;
  /** Cari levelin tam eni (ekran 29-dakı "850") */
  xpForLevel: number;
  /** Növbəti levelə qalan XP (ekran 29-dakı "300 XP lazımdır") */
  xpToNext: number;
  percent: number;
  isMax: boolean;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const tier = tierForLevel(level);
  const isMax = level >= MAX_LEVEL;
  const floor = LEVEL_XP[level - 1];
  const ceil = isMax ? floor : LEVEL_XP[level];
  const xpForLevel = isMax ? 0 : ceil - floor;
  const xpInLevel = totalXp - floor;
  return {
    level,
    tier,
    xpInLevel,
    xpForLevel,
    xpToNext: isMax ? 0 : ceil - totalXp,
    percent: isMax ? 100 : Math.min(100, Math.round((xpInLevel / xpForLevel) * 100)),
    isMax,
  };
}

/** XP mənbələri — slayd 8. `dailyCap` sui-istifadəyə qarşıdır (null = limitsiz). */
export const XP_RULES = {
  place_checkin: { xp: 600, dailyCap: 3, nameAz: 'Məkanı kəşf et', nameEn: 'Discover a place', nameRu: 'Открыть место' },
  experience_completed: { xp: 800, dailyCap: null, nameAz: 'Təcrübə yaşa', nameEn: 'Enjoy an experience', nameRu: 'Посетить впечатление' },
  review_written: { xp: 400, dailyCap: 3, nameAz: 'Rəy yaz', nameEn: 'Write a review', nameRu: 'Написать отзыв' },
  media_shared: { xp: 300, dailyCap: 5, nameAz: 'Foto / Video paylaş', nameEn: 'Share a photo / video', nameRu: 'Поделиться фото / видео' },
  route_created: { xp: 350, dailyCap: 2, nameAz: 'Marşrut yarat', nameEn: 'Create a route', nameRu: 'Создать маршрут' },
  profile_completed: { xp: 100, dailyCap: null, nameAz: 'Profili tamamla', nameEn: 'Complete your profile', nameRu: 'Заполнить профиль' },
  booking_completed: { xp: 50, dailyCap: null, nameAz: 'Rezervasiya tamamla', nameEn: 'Complete a booking', nameRu: 'Завершить бронирование' },
  trip_completed: { xp: 500, dailyCap: null, nameAz: 'Səyahəti tamamla', nameEn: 'Complete a trip', nameRu: 'Завершить поездку' },
} as const;

export type XpAction = keyof typeof XP_RULES;

/**
 * Gezgin Score — XP-dən fərqli, "aktivlik keyfiyyəti" göstəricisi (ekran 07, 08, 29).
 * Səyahət genişliyini (region, məkan) və icma töhfəsini (rəy, paylaşım) çəkiləri ilə birləşdirir.
 */
export const SCORE_WEIGHTS = {
  region: 40,
  place: 12,
  experience: 20,
  route: 15,
  review: 8,
  post: 5,
  followerCap: 250,
} as const;

export interface ScoreInput {
  regions: number; places: number; experiences: number;
  routes: number; reviews: number; posts: number; followers: number;
}

export function gezginScore(i: ScoreInput): number {
  const w = SCORE_WEIGHTS;
  return Math.round(
    i.regions * w.region + i.places * w.place + i.experiences * w.experience +
    i.routes * w.route + i.reviews * w.review + i.posts * w.post +
    Math.min(i.followers, w.followerCap),
  );
}

export const BADGE_CONDITIONS = [
  'places_visited', 'posts_created', 'routes_created', 'experiences_done',
  'level_reached', 'reviews_written', 'regions_visited', 'checkins',
] as const;
export type BadgeCondition = (typeof BADGE_CONDITIONS)[number];
