/**
 * Azərbaycan vaxtı (Asia/Baku) — UTC+4, 2016-dan yay vaxtı yoxdur.
 * "Gündə bir dəfə" tipli qaydalar istifadəçinin təqvim gününə görə sayılır,
 * serverin saat qurşağından (konteynerdə UTC) asılı olmamalıdır.
 */
const BAKU_OFFSET_MS = 4 * 3600_000;

/** Verilən anın düşdüyü Bakı təqvim gününün başlanğıcı (UTC Date kimi). */
export function bakuDayStart(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + BAKU_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BAKU_OFFSET_MS);
}
