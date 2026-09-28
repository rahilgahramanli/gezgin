import { AsyncLocalStorage } from 'node:async_hooks';

export type Lang = 'az' | 'en' | 'ru';

/**
 * `Accept-Language` başlığından dil — az defoltdur, yalnız en və ru tanınır.
 * "en-US,en;q=0.9" → en, "ru-RU" → ru, "*" və ya "fr" → az.
 * Admin paneli başlıq göndərmir (Node fetch `*` qoyur) — həmişə az alır.
 */
export const parseLang = (header?: string | string[] | null): Lang => {
  const raw = Array.isArray(header) ? header[0] : header;
  const v = raw?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

/**
 * Sorğunun dili — `LangMiddleware` hər HTTP sorğusunu bu kontekstdə işlədir.
 *
 * Dil controller-dən servisə parametr kimi ötürülən yerlərdə (məkan, marşrut,
 * region tərcümələri) elə qalır. Kontekst dərin köməkçilər üçündür: istifadəçi
 * kartındakı tier adı, badge və kateqoriya adları, rezervasiya sətirləri —
 * onları onlarla servis çağırır və hər imzaya `lang` əlavə etmək lazım gəlməsin.
 * Sorğudan kənarda (cron, worker, testdə birbaşa servis çağırışı) az qaytarır.
 */
const storage = new AsyncLocalStorage<{ lang: Lang }>();

export const currentLang = (): Lang => storage.getStore()?.lang ?? 'az';

export const runWithLang = <T>(lang: Lang, fn: () => T): T => storage.run({ lang }, fn);

/** Üç dilli mətndən cari dilə uyğun olanı — boşdursa az. */
export const pickText = (texts: { az: string; en?: string | null; ru?: string | null }, lang: Lang = currentLang()): string =>
  (lang === 'az' ? texts.az : texts[lang]) || texts.az;
