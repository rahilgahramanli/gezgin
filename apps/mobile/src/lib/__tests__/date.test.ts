/**
 * Yerli təqvim günü — CreateTrip-də "5 okt" çipi Bakıda 00:00–04:00 arası
 * `toISOString()` səbəbindən 4 oktyabr kimi göndərilirdi.
 */
import { addLocalDays, localIsoDate } from '@/lib/date';

// `jest.config.js` TZ-ni `Asia/Baku` edir
it('testlər Bakı saat qurşağında işləyir', () => {
  expect(new Date('2026-10-04T21:30:00Z').getHours()).toBe(1);
});

describe('localIsoDate', () => {
  it('Bakıda gecə 01:30 — UTC hələ əvvəlki gündür, amma yerli gün götürülür', () => {
    const d = new Date('2026-10-04T21:30:00Z'); // Bakı: 5 oktyabr 01:30
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-04');
    expect(localIsoDate(d)).toBe('2026-10-05');
  });

  it('çipdə göstərilən gün ilə göndərilən gün eynidir', () => {
    const now = new Date('2026-09-27T22:10:00Z'); // Bakı: 28 sentyabr 02:10
    const chip = addLocalDays(7, now);
    expect(chip.getDate()).toBe(5);
    expect(localIsoDate(chip)).toBe('2026-10-05');
  });
});
