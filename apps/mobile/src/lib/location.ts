import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/**
 * Mövqe — check-in (ekran 51/52), "Yaxınlıqda" lenti və xəritə üçün.
 *
 * Server check-in-də `lat`/`lng`-i MƏCBURİ tələb edir və məkana yaxınlığı
 * yoxlayır. Ona görə `locate()` uğursuzluğun səbəbini qaytarır — ekran
 * "icazə yoxdur" ilə "GPS cavab vermədi"-ni fərqli izah edə bilsin.
 *
 * Heç bir çağırış sonsuza qədər gözləmir: həm icazə, həm mövqe sorğusu
 * taymerlə qorunur.
 */
export interface Coords {
  lat: number;
  lng: number;
  accuracyM: number | null;
}

export type LocateFailure = 'denied' | 'unavailable' | 'timeout';
export type LocateResult = { ok: true; coords: Coords } | { ok: false; reason: LocateFailure };

let configured = false;
function configure(): void {
  if (configured) return;
  // `skipPermissionRequests: true` — icazəni özümüz istəyirik ki, `getCurrentPosition`
  // taymeri istifadəçi dialoqa cavab verərkən işləməsin (əks halda 8 saniyə sonra
  // taymaut yanır və check-in mövqesiz gedir).
  Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' });
  configured = true;
}

/**
 * Tətbiq sessiyası ərzində icazənin son məlum vəziyyəti.
 *
 * iOS-da `requestAuthorization` callback-i yalnız icazə vəziyyəti DƏYİŞƏNDƏ
 * (və ya location manager ilk dəfə yaranarkən) çağırılır. İkinci çağırışda
 * vəziyyət eynidir → callback heç vaxt gəlmir və check-in "Mövqe müəyyən
 * edilir…" ekranında əbədi ilişirdi. Ona görə verilmiş icazəni yadda saxlayırıq.
 */
let permission: 'unknown' | 'granted' | 'denied' = 'unknown';
let asked = false;
let inFlight: Promise<boolean | null> | null = null;

/**
 * İlk sorğuda sistem dialoqu çıxır — istifadəçiyə oxumağa vaxt veririk. Vaxt
 * bitsə də itki yoxdur: mövqe sorğusu öz taymeri ilə gözləyir, gec gələn
 * icazə isə `permission`-u yeniləyir və növbəti cəhd dərhal keçir.
 */
const FIRST_ASK_TIMEOUT_MS = 10_000;
/** Sonrakı sorğularda dialoq çıxmır, callback gəlməyə bilər — tez davam edirik. */
const REPEAT_ASK_TIMEOUT_MS = 1_500;

/**
 * iOS icazəsi: `true` — verilib, `false` — rədd edilib, `null` — bilinmir
 * (callback vaxtında gəlmədi). `null` halında `getCurrentPosition` özü
 * qərar verir: rədd edilibsə dərhal xəta qaytarır, icazə varsa mövqeni verir.
 */
function requestIosPermission(): Promise<boolean | null> {
  if (permission === 'granted') return Promise.resolve(true);
  // Rədd edilib: dialoq bir daha çıxmır. İstifadəçi Tənzimləmələrdən açıbsa
  // native tərəf bunu bilir — birbaşa mövqe sorğusuna keçirik.
  if (permission === 'denied') return Promise.resolve(null);
  if (inFlight) return inFlight;

  const timeoutMs = asked ? REPEAT_ASK_TIMEOUT_MS : FIRST_ASK_TIMEOUT_MS;
  asked = true;

  inFlight = new Promise<boolean | null>((resolve) => {
    let settled = false;
    const settle = (value: boolean | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      inFlight = null;
      resolve(value);
    };
    const timer = setTimeout(() => settle(null), timeoutMs);

    // Callback taymautdan SONRA gəlsə də vəziyyəti yeniləyirik — növbəti cəhd dərhal keçsin
    Geolocation.requestAuthorization(
      () => {
        permission = 'granted';
        settle(true);
      },
      () => {
        permission = 'denied';
        settle(false);
      },
    );
  });
  return inFlight;
}

async function requestAndroidPermission(): Promise<boolean> {
  if (permission === 'granted') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Mövqe icazəsi',
    message: 'Check-in üçün məkanda olduğunu təsdiqləməliyik.',
    buttonPositive: 'İcazə ver',
    buttonNegative: 'İmtina',
  });
  const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
  permission = ok ? 'granted' : 'denied';
  return ok;
}

/** İcazə — `null` "bilinmir, mövqe sorğusu yoxlasın" deməkdir. */
async function requestPermission(): Promise<boolean | null> {
  if (Platform.OS === 'ios') return requestIosPermission();
  if (Platform.OS === 'android') return requestAndroidPermission();
  return true;
}

/** Onboarding (ekran 39) mövqe almadan yalnız icazə istəyir. */
export async function ensurePermission(): Promise<boolean> {
  configure();
  return (await requestPermission()) !== false;
}

/** `PERMISSION_DENIED = 1`, `POSITION_UNAVAILABLE = 2`, `TIMEOUT = 3` (W3C). */
function failureFromCode(code: number | undefined): LocateFailure {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

/**
 * Cari mövqe və ya uğursuzluğun səbəbi. Native taymer işləməsə belə
 * JS tərəfdə əlavə taymer var — nəticə mütləq qayıdır.
 */
export async function locate(timeoutMs = 8000): Promise<LocateResult> {
  configure();
  const allowed = await requestPermission();
  if (allowed === false) return { ok: false, reason: 'denied' };

  return new Promise<LocateResult>((resolve) => {
    let settled = false;
    const settle = (result: LocateResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(result);
    };
    const guard = setTimeout(() => settle({ ok: false, reason: 'timeout' }), timeoutMs + 2000);

    Geolocation.getCurrentPosition(
      (pos) => {
        permission = 'granted';
        settle({
          ok: true,
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy ?? null,
          },
        });
      },
      (error) => {
        const reason = failureFromCode(error?.code);
        if (reason === 'denied') permission = 'denied';
        settle({ ok: false, reason });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** İcazə yoxdursa və ya GPS cavab vermirsə `null` — lent və xəritə səbəbi göstərmir. */
export async function getCurrentPosition(timeoutMs = 8000): Promise<Coords | null> {
  const result = await locate(timeoutMs);
  return result.ok ? result.coords : null;
}

/** Ekranlarda göstərilən izah — check-in və yaxınlıqdakı məkanlar. */
export function locateFailureText(reason: LocateFailure): string {
  switch (reason) {
    case 'denied':
      return 'GEZGIN-ə yerləşmə icazəsi verilməyib. Tənzimləmələrdən icazə ver və yenidən cəhd et.';
    case 'timeout':
      return 'GPS vaxtında cavab vermədi. Açıq yerə çıx və yenidən cəhd et.';
    default:
      return 'Cihazın yerləşməsi müəyyən edilmədi. Yerləşmə xidmətinin açıq olduğunu yoxla.';
  }
}
