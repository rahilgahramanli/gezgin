import i18n, { pluralForm, tp } from '@/i18n';
import { durationLabel } from '@/lib/labels';
import { timeAgo } from '@/lib/time';

/**
 * Cəm formaları əl ilə seçilir (Hermes-də Intl.PluralRules yoxdur) — rus
 * dilinin 1/2–4/5+ qaydası və 11–14 istisnası ən çox səhv olunan yerdir.
 */
describe('i18n', () => {
  afterEach(() => i18n.changeLanguage('az'));

  it('rus cəm formaları 21/22/25/11/112 üçün düzdür', () => {
    expect([1, 21, 101].map((n) => pluralForm(n, 'ru'))).toEqual(['one', 'one', 'one']);
    expect([2, 4, 22, 34].map((n) => pluralForm(n, 'ru'))).toEqual(['few', 'few', 'few', 'few']);
    expect([0, 5, 11, 12, 14, 25, 112].map((n) => pluralForm(n, 'ru'))).toEqual(
      ['many', 'many', 'many', 'many', 'many', 'many', 'many'],
    );
    expect(pluralForm(1, 'en')).toBe('one');
    expect(pluralForm(1, 'az')).toBe('other');
  });

  it('tp hər dildə düzgün formanı və sayı qoyur', async () => {
    expect(tp('common:time.days', 3)).toBe('3 gün');
    await i18n.changeLanguage('en');
    expect(tp('common:time.days', 1)).toBe('1 day');
    expect(tp('common:time.days', 3)).toBe('3 days');
    await i18n.changeLanguage('ru');
    expect(tp('common:time.days', 1)).toBe('1 день');
    expect(tp('common:time.days', 3)).toBe('3 дня');
    expect(tp('common:time.days', 11)).toBe('11 дней');
    expect(tp('common:time.days', 21)).toBe('21 день');
  });

  it('tp yuxarı səviyyəli dəyişənləri də mətnə qoyur', async () => {
    const key = 'common:__test.visited';
    i18n.addResource('az', 'common', '__test.visited_other', '{{count}} yer · {{region}}');
    expect(tp(key, 4, { region: 'Quba' })).toBe('4 yer · Quba');
    expect(tp(key, 4, { replace: { region: 'Şəki' } })).toBe('4 yer · Şəki');
  });

  it('köməkçilər dil dəyişəndə yeni dildə qaytarır', async () => {
    expect(durationLabel('1-gun')).toBe('1 gün');
    await i18n.changeLanguage('en');
    expect(durationLabel('1-gun')).toBe('1 day');
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2 hours ago');
    await i18n.changeLanguage('ru');
    expect(timeAgo(twoHoursAgo)).toBe('2 часа назад');
  });
});
