import { ERROR_CODES, type ErrorCode } from '@gezgin/shared';
import { env } from '@/config/env';

const BASE_URL = env.apiUrl;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Validasiya xətasında server `details`-də sahə mesajlarını qaytarır — ümumi
 * "Validasiya xətası" əvəzinə istifadəçiyə konkret səbəbi göstəririk.
 * Azərbaycanca mesajlar üstündür (class-validator-un ingiliscə defoltları deyil).
 */
function readableMessage(code: string | undefined, message: string | undefined, details: unknown): string {
  if (code === ERROR_CODES.VALIDATION_FAILED && Array.isArray(details)) {
    const texts = details.filter((d): d is string => typeof d === 'string');
    const az = texts.find((d) => /[əğıöüçşİƏ]/.test(d));
    if (az) return az;
  }
  return message ?? 'Şəbəkə xətası';
}

/** Server cavab vermir (internet yoxdur, server dayanıb) — ekranlar bu kodla fərqləndirir. */
export const NETWORK_ERROR = 'NETWORK';

/** İstifadəçinin seçdiyi dil — kontent (məkan adları, təsvirlər) bu dildə gəlir. */
let contentLanguage: 'az' | 'en' | 'ru' = 'az';
export const setContentLanguage = (lang: 'az' | 'en' | 'ru'): void => {
  contentLanguage = lang;
};

let accessToken: string | null = null;
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};
/** WebSocket hər (yenidən) qoşulmada ən təzə tokeni buradan oxuyur. */
export const getAccessToken = (): string | null => accessToken;

/**
 * Access token 15 dəqiqədən sonra bitir. 401 gələndə klient bir dəfə
 * `/auth/refresh` çağırır və sorğunu təkrarlayır. Refresh məntiqi auth
 * store-dadır (sessiyanı yaddaşa yazır) — dairəvi idxaldan qaçmaq üçün
 * buraya callback kimi qeydiyyatdan keçir.
 */
type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;
export const setRefreshHandler = (handler: RefreshHandler | null): void => {
  refreshHandler = handler;
};

/** Paralel 401-lər tək refresh sorğusunu paylaşır. */
let inFlightRefresh: Promise<string | null> | null = null;

async function refreshOnce(): Promise<string | null> {
  if (!refreshHandler) return null;
  inFlightRefresh ??= refreshHandler().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  language?: 'az' | 'en' | 'ru';
  /** Daxili — təkrar cəhdin sonsuz dövrəyə düşməməsi üçün. */
  _retried?: boolean;
}

/**
 * Tək HTTP nöqtəsi — bütün sorğular buradan keçir.
 * Backend xətanı `{ statusCode, code, message, details }` kimi qaytarır;
 * ekranlar `code` sahəsinə görə tərcümə göstərir, `message` developer üçündür.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, language = contentLanguage, headers, _retried, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': language,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Bağlantı problemi — internetini yoxla və yenidən cəhd et');
  }

  if (res.status === 204) return undefined as T;

  const payload = (await res.json().catch(() => null)) as
    | { code?: string; message?: string; details?: unknown }
    | null;

  if (!res.ok) {
    const expired =
      res.status === 401 &&
      (payload?.code === ERROR_CODES.TOKEN_EXPIRED || payload?.code === ERROR_CODES.UNAUTHORIZED);

    if (expired && !_retried && refreshHandler) {
      const fresh = await refreshOnce();
      if (fresh) return api<T>(path, { ...options, _retried: true });
    }

    throw new ApiError(
      res.status,
      payload?.code ?? ERROR_CODES.INTERNAL,
      readableMessage(payload?.code, payload?.message, payload?.details),
      payload?.details,
    );
  }

  return payload as T;
}

/** Refresh sorğusu `api()`-dən keçmir — əks halda 401 dövrəsi yaranardı. */
export async function rawPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Bağlantı problemi — internetini yoxla və yenidən cəhd et');
  }
  const payload = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  if (!res.ok) throw new ApiError(res.status, payload?.code ?? 'REFRESH_FAILED', payload?.message ?? 'Sessiya yenilənmədi');
  return payload as T;
}

export const apiBaseUrl = BASE_URL;
