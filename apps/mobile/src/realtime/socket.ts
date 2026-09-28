import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { currentLang } from '@/i18n';
import { env } from '@/config/env';
import { api, getAccessToken } from '@/api/client';

/** API bazası `/api/v1`-lə bitir; socket kök ünvanda, `/ws` namespace-indədir. */
const WS_URL = `${env.apiUrl.replace(/\/api\/v1\/?$/, '')}/ws`;

/** Ardıcıl rədd sayı — refresh token da etibarsızdırsa sonsuz dövrə yaranmasın. */
const MAX_REJECTS = 3;

let socket: Socket | null = null;

/**
 * Tək socket bağlantısı — sessiya açıq olduqca yaşayır.
 *
 * Server vaxtı bitmiş tokenlə gələni `disconnect(true)` ilə atır və socket.io
 * belə halda özü yenidən qoşulmur. Ona görə istənilən autentifikasiyalı sorğu
 * ilə tokeni təzələyirik (`api()` 401-də refresh edir) və əl ilə qoşuluruq.
 * `auth` funksiyadır — hər cəhddə ən təzə tokeni oxuyur.
 */
export function connectRealtime(): Socket {
  if (socket) return socket;

  const s = io(WS_URL, {
    transports: ['websocket'],
    // RN socket-i başlıq göndərə bilmir — canlı bildirişlərin dili `auth.lang` ilə
    auth: (cb) => cb({ token: getAccessToken() ?? '', lang: currentLang() }),
    reconnectionDelayMax: 10_000,
  });

  let lastCode: string | undefined;
  let rejects = 0;
  s.on('ready', () => {
    rejects = 0;
  });
  s.on('exception', (e: { code?: string }) => {
    lastCode = e?.code;
  });
  s.on('disconnect', (reason) => {
    // Qonaq hesabı çata qoşula bilməz — yenidən cəhdin mənası yoxdur
    if (reason !== 'io server disconnect' || lastCode === 'FORBIDDEN' || ++rejects > MAX_REJECTS) return;
    setTimeout(() => {
      void api('/notifications?limit=1')
        .catch(() => undefined)
        .finally(() => {
          if (socket === s) s.connect();
        });
    }, 1500);
  });

  socket = s;
  return s;
}

/** Dil dəyişəndə canlı bildirişlər yeni dildə gəlsin — qoşulmada `auth.lang` təzədən oxunur. */
export function refreshRealtimeLanguage(): void {
  if (!socket?.connected) return;
  socket.disconnect();
  socket.connect();
}

export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
}

export function emitRealtime(event: string, payload: unknown): void {
  socket?.emit(event, payload);
}

/**
 * Komponent ömrü boyu socket hadisəsinə abunə.
 * Handler ref-də saxlanılır — hər render-də yenidən abunə olmur.
 */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const s = connectRealtime();
    const listener = (payload: T) => ref.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [event]);
}
