import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/**
 * Mövqe — check-in məsafə yoxlaması üçün (ekran 51/52).
 *
 * Server `lat`/`lng` gələndə məkana yaxınlığı yoxlayır, gəlməyəndə isə
 * yoxlamanı ötürür. Ona görə burada xəta atmırıq: GPS alınmasa `null`
 * qaytarırıq və check-in yenə də baş tutur, sadəcə məsafə yoxlanılmır.
 */
export interface Coords {
  lat: number;
  lng: number;
  accuracyM: number | null;
}

let configured = false;
function configure(): void {
  if (configured) return;
  // `skipPermissionRequests: true` — icazəni özümüz istəyirik ki, `getCurrentPosition`
  // taymeri istifadəçi dialoqa cavab verərkən işləməsin (əks halda 8 saniyə sonra
  // taymaut yanır və check-in mövqesiz gedir).
  Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' });
  configured = true;
}

/** iOS icazə dialoqu — istifadəçi cavab verənə qədər gözləyir, taymaut yoxdur. */
function requestIosPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

/** Onboarding (ekran 39) mövqe almadan yalnız icazə istəyir. */
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return requestIosPermission();
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Mövqe icazəsi',
      message: 'Check-in üçün məkanda olduğunu təsdiqləməliyik.',
      buttonPositive: 'İcazə ver',
      buttonNegative: 'İmtina',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/** İcazə yoxdursa və ya GPS cavab vermirsə `null` — çağıran tərəf bunu gözləyir. */
export async function getCurrentPosition(timeoutMs = 8000): Promise<Coords | null> {
  configure();
  if (!(await ensurePermission())) return null;

  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
