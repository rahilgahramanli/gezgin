import { Platform, Share } from 'react-native';

/** Paylaşılan linklərin qısa yolları — veb tərəf eyni sxemi gözləyir. */
const PATHS = { place: 'm', route: 'r', experience: 't', business: 'b' } as const;

export type ShareType = keyof typeof PATHS;

export function shareUrl(type: ShareType, slug: string): string {
  return `https://gezgin.app/${PATHS[type]}/${slug}`;
}

/**
 * Sistem paylaşma vərəqini açır. İstifadəçi ləğv edəndə Share xəta atmır,
 * ona görə yalnız həqiqi nasazlıqlar udulur — istifadəçiyə xəbərdarlıq lazım deyil.
 */
export async function shareItem(type: ShareType, slug: string, title: string): Promise<void> {
  const url = shareUrl(type, slug);
  try {
    await Share.share(
      Platform.OS === 'ios' ? { message: title, url } : { message: `${title}\n${url}` },
      { subject: title, dialogTitle: 'GEZGIN-də paylaş' },
    );
  } catch {
    // paylaşma vərəqi açılmadı — səssiz keç
  }
}
