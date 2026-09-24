import { Alert } from 'react-native';
import { ApiError } from '@/api/client';

/**
 * Mutasiya xətasını istifadəçiyə göstərir.
 *
 * Səssiz uğursuzluq ən pis haldır: optimistik dəyişiklik geri dönür və
 * istifadəçi toxunuşun niyə işləmədiyini bilmir (qonaq hesabı, şəbəkə, blok).
 */
export function alertError(error: unknown, fallback = 'Əməliyyat alınmadı'): void {
  const api = error instanceof ApiError ? error : null;

  if (api?.code === 'FORBIDDEN') {
    Alert.alert('Hesab lazımdır', api.message);
    return;
  }
  Alert.alert('Alınmadı', api?.message ?? fallback);
}
