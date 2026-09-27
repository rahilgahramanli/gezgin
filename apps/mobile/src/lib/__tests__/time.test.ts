import {
  bakuDate, bakuDateTime, bakuDayAt, bakuDayKey, bakuShortDate, bakuStartOfDay, bakuTime, bakuWeekday,
} from '@/lib/time';

/**
 * Bakı vaxtı (UTC+4) — QA-da slot 2026-10-01T23:00Z "1 okt 23:00" kimi
 * göstərilirdi, halbuki Bakıda artıq 2 oktyabr 03:00-dır.
 */
describe('Bakı vaxtı', () => {
  const lateUtc = '2026-10-01T23:00:00.000Z';

  it('UTC gecəsini Bakının növbəti gününə keçirir', () => {
    expect(bakuDate(lateUtc)).toBe('2 okt 2026');
    expect(bakuShortDate(lateUtc)).toBe('2 okt');
    expect(bakuTime(lateUtc)).toBe('03:00');
    expect(bakuDateTime(lateUtc)).toBe('2 okt 2026, 03:00');
    expect(bakuDayKey(lateUtc)).toBe('2026-10-02');
    // 2 oktyabr 2026 — cümə
    expect(bakuWeekday(lateUtc)).toBe('Cü');
  });

  it('ilin sonunda ili də dəyişir', () => {
    expect(bakuDate('2026-12-31T21:30:00Z')).toBe('1 yan 2027');
    expect(bakuTime('2026-12-31T21:30:00Z')).toBe('01:30');
  });

  it('bütün ay adları azərbaycanca qısaltmadır', () => {
    const months = Array.from({ length: 12 }, (_, m) => bakuShortDate(Date.UTC(2026, m, 15, 8)));
    expect(months).toEqual([
      '15 yan', '15 fev', '15 mar', '15 apr', '15 may', '15 iyn',
      '15 iyl', '15 avq', '15 sen', '15 okt', '15 noy', '15 dek',
    ]);
  });

  it('Bakı gününün başlanğıcı 20:00 UTC-dir', () => {
    expect(new Date(bakuStartOfDay(lateUtc)).toISOString()).toBe('2026-10-01T20:00:00.000Z');
    expect(new Date(bakuStartOfDay('2026-10-01T19:59:59Z')).toISOString()).toBe('2026-09-30T20:00:00.000Z');
  });

  it('otel girişi Bakı vaxtı ilə 14:00-a düşür', () => {
    const now = Date.parse(lateUtc); // Bakıda 2 okt, 03:00
    expect(new Date(bakuDayAt(0, 14, now)).toISOString()).toBe('2026-10-02T10:00:00.000Z');
    expect(bakuDate(bakuDayAt(7, 14, now))).toBe('9 okt 2026');
  });
});
