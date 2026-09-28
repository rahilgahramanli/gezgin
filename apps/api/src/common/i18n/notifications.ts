import { badgeByAzDescription, badgeByAzName, tierName } from './gamification';
import { levelText } from './format';
import type { Lang } from './lang';

/**
 * Bildirişlər yaranarkən Azərbaycan dilində saxlanılır (`title_az`, `body_az`) —
 * alıcının dili həmin an məlum deyil. Oxunanda şablona görə tərcümə olunur.
 * Aktyorun adı və şərhin mətni (istifadəçi kontenti) olduğu kimi qalır.
 * Tanınmayan mətn dəyişmir.
 */

/** Aktyor tapılmayanda `NotificationsService` "Kimsə" yazır. */
const actorName = (name: string, lang: 'en' | 'ru'): string =>
  name === 'Kimsə' ? (lang === 'en' ? 'Someone' : 'Кто-то') : name;

type Rule = { re: RegExp; en: (m: RegExpMatchArray) => string; ru: (m: RegExpMatchArray) => string };

/**
 * Tip üzrə başlıq şablonları. Şərh önizləməsi 190 simvolda kəsilə bilər —
 * bağlanan dırnaq olmaya da bilər, ona görə son `"` məcburi deyil.
 */
const TITLE_RULES: Partial<Record<string, Rule[]>> = {
  social_like: [
    {
      re: /^(\S+) paylaşımını bəyəndi$/,
      en: (m) => `${actorName(m[1], 'en')} liked your post`,
      ru: (m) => `${actorName(m[1], 'ru')} оценил(а) вашу публикацию`,
    },
  ],
  social_comment: [
    {
      re: /^(\S+) şərhinə cavab yazdı: "([\s\S]*)$/,
      en: (m) => `${actorName(m[1], 'en')} replied to your comment: "${m[2]}`,
      ru: (m) => `${actorName(m[1], 'ru')} ответил(а) на ваш комментарий: "${m[2]}`,
    },
    {
      re: /^(\S+) şərh yazdı: "([\s\S]*)$/,
      en: (m) => `${actorName(m[1], 'en')} commented: "${m[2]}`,
      ru: (m) => `${actorName(m[1], 'ru')} прокомментировал(а): "${m[2]}`,
    },
  ],
  social_follow: [
    {
      re: /^(\S+) səni izləməyə başladı$/,
      en: (m) => `${actorName(m[1], 'en')} started following you`,
      ru: (m) => `${actorName(m[1], 'ru')} подписался(-ась) на вас`,
    },
  ],
  level_up: [
    {
      re: /^Yeni səviyyə: Level (\d+) · (.+)$/,
      en: (m) => `New level: ${levelText(m[1], 'en')} · ${tierName(m[2], 'en')}`,
      ru: (m) => `Новый уровень: ${levelText(m[1], 'ru')} · ${tierName(m[2], 'ru')}`,
    },
  ],
  badge_earned: [
    {
      re: /^Yeni badge: (.+) 🎉$/,
      en: (m) => `New badge: ${badgeByAzName(m[1])?.nameEn ?? m[1]} 🎉`,
      ru: (m) => `Новое достижение: ${badgeByAzName(m[1])?.nameRu ?? m[1]} 🎉`,
    },
  ],
};

export function translateNotification(
  n: { type: string; title: string; body: string | null },
  lang: Lang,
): { title: string; body: string | null } {
  if (lang === 'az') return { title: n.title, body: n.body };

  let title = n.title;
  // Tip dəyişibsə (köhnə sətirlər) bütün şablonlar yoxlanılır
  const rules = TITLE_RULES[n.type] ?? Object.values(TITLE_RULES).flat() as Rule[];
  for (const r of rules) {
    const m = n.title.match(r.re);
    if (m) {
      title = r[lang](m);
      break;
    }
  }

  // Gövdə: "+350 XP" hər dildə eynidir; badge bildirişində badge-in təsviridir
  let body = n.body;
  if (body && n.type === 'badge_earned') {
    const badge = badgeByAzDescription(body);
    if (badge) body = lang === 'en' ? badge.descriptionEn : badge.descriptionRu;
  }
  return { title, body };
}
