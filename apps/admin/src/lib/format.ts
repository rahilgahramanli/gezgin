// Server konteyneri UTC-dədir — moderator Bakı vaxtını görməlidir
const DATE = new Intl.DateTimeFormat('az-AZ', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Baku',
});

export function when(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return DATE.format(new Date(value));
}

/** Şikayətin yaşı — moderator 24 saatlıq SLA-nı bir baxışda görməlidir. */
export function ageLabel(hours: number): { text: string; level: 'ok' | 'warn' | 'late' } {
  if (hours < 1) return { text: 'indicə', level: 'ok' };
  if (hours < 24) return { text: `${hours} saat`, level: hours >= 18 ? 'warn' : 'ok' };
  const days = Math.floor(hours / 24);
  return { text: days === 1 ? '1 gün' : `${days} gün`, level: 'late' };
}

/** API-nin `REPORT_REASONS` siyahısı ilə eyni (community.dto.ts). */
export const REASONS: Record<string, string> = {
  spam: 'Spam',
  inappropriate: 'Uyğunsuz kontent',
  harassment: 'Təhqir',
  false_info: 'Yanlış məlumat',
  copyright: 'Müəllif hüququ',
  other: 'Digər',
};

export const REPORT_STATUS: Record<string, string> = {
  open: 'açıq',
  reviewing: 'baxılır',
  resolved: 'həll olunub',
  rejected: 'rədd edilib',
};

export const TARGET_LABELS: Record<string, string> = {
  post: 'Paylaşım',
  comment: 'Şərh',
  review: 'Rəy',
  message: 'Mesaj',
  user: 'İstifadəçi',
  place: 'Məkan',
  experience: 'Təcrübə',
};
