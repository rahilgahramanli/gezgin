import { Alert } from 'react-native';
import i18n from '@/i18n';
import { ApiError } from '@/api/client';
import { useAuth } from '@/store/auth';

/** Cari sessiya qonaq sessiyasıdırmı — hook olmayan yerlərdən (callback, alert). */
export const isGuestSession = (): boolean => useAuth.getState().session?.user.isGuest ?? false;

/**
 * Qonaq hesab tələb edən əməliyyata toxunanda: səbəb + birbaşa qeydiyyata keçid.
 * Sadəcə "OK" düyməsi istifadəçini dalana dirəyirdi.
 */
export function promptGuestSignup(message: string = i18n.t('common:guest.message')): void {
  Alert.alert(i18n.t('common:guest.title'), message, [
    { text: i18n.t('common:actions.notNow'), style: 'cancel' },
    { text: i18n.t('common:actions.signUp'), onPress: () => void useAuth.getState().upgradeGuest() },
  ]);
}

/** Qonağın qadağan olunmuş əməliyyatı (403 FORBIDDEN) — ekranlar fərqli göstərmək üçün yoxlayır. */
export const isGuestBlocked = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'FORBIDDEN' && isGuestSession();

/**
 * Mutasiya xətasını istifadəçiyə göstərir.
 *
 * Səssiz uğursuzluq ən pis haldır: optimistik dəyişiklik geri dönür və
 * istifadəçi toxunuşun niyə işləmədiyini bilmir (qonaq hesabı, şəbəkə, blok).
 */
export function alertError(error: unknown, fallback: string = i18n.t('common:errors.generic')): void {
  const api = error instanceof ApiError ? error : null;

  if (api?.code === 'FORBIDDEN' && isGuestSession()) {
    promptGuestSignup(api.message);
    return;
  }
  Alert.alert(i18n.t('common:errors.alertTitle'), api?.message ?? fallback);
}

/** Xətadan istifadəçiyə göstəriləcək mətn — inline xəta sətirləri üçün. */
export function errorText(error: unknown, fallback: string = i18n.t('common:errors.generic')): string {
  return error instanceof ApiError ? error.message : fallback;
}
