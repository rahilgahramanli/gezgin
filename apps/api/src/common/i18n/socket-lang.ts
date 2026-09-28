import { parseLang, type Lang } from './lang';

/** Socket-in minimal forması — socket.io tipindən asılı olmamaq üçün. */
export interface SocketLike {
  data?: { lang?: Lang };
  handshake?: {
    auth?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, string | string[] | undefined>;
  };
}

/**
 * Socket bağlantısının dili. React Native WebSocket-i başlıq göndərə bilmir —
 * ona görə `io(url, { auth: { token, lang } })` və ya `?lang=` də qəbul olunur,
 * sonra `Accept-Language`. Heç biri yoxdursa az.
 */
export function socketLang(client: SocketLike): Lang {
  if (client.data?.lang) return client.data.lang;
  const h = client.handshake;
  const explicit = h?.auth?.lang ?? h?.query?.lang;
  if (typeof explicit === 'string' && explicit) return parseLang(explicit);
  return parseLang(h?.headers?.['accept-language']);
}
