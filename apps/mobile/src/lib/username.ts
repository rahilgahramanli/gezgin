/**
 * İstifadəçi adı qaydası serverlə eynidir: 3–32 simvol, yalnız a-z, 0-9, nöqtə və alt xətt.
 * Yazarkən təmizləyirik ki, istifadəçi server xətası almasın (böyük hərf, boşluq, ə/ş).
 */
const AZ_FOLD: Record<string, string> = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c', ğ: 'g' };

export function sanitizeUsername(v: string): string {
  return v
    .toLowerCase()
    .replace(/[əıöüşçğ]/g, (ch) => AZ_FOLD[ch] ?? '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 32);
}
