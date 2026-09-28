import type { Asset } from 'react-native-image-picker';
import { ApiError, api } from '@/api/client';
import i18n from '@/i18n';

export type UploadFolder = 'post' | 'review' | 'avatar' | 'cover';

/**
 * Seçicidən gələn MIME həmişə kanonik olmur — iOS qalereyası `image/jpg`
 * qaytarır, server isə `image/jpeg` gözləyir (MEDIA.imageMime). Növ tanınmasa
 * fayl uzantısından çıxarılır, o da yoxdursa JPEG fərz olunur.
 */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/heif': 'image/heic',
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
};

const SUPPORTED = new Set(Object.values(MIME_BY_EXT));

export function contentTypeOf(asset: Asset): string {
  const raw = (asset.type ?? '').toLowerCase();
  const normalized = MIME_ALIASES[raw] ?? raw;
  if (SUPPORTED.has(normalized)) return normalized;

  const name = (asset.fileName ?? asset.uri ?? '').toLowerCase().split('?')[0] ?? '';
  const ext = name.slice(name.lastIndexOf('.') + 1);
  return MIME_BY_EXT[ext] ?? 'image/jpeg';
}

export interface UploadedMedia {
  publicId: string;
  url: string;
}

/**
 * Foto yükləmə — fayl API-dən keçmir:
 * `POST /media/presign` → `PUT uploadUrl` (birbaşa S3/MinIO) → `POST /media/:id/complete`.
 *
 * Qeyd: dev-də presign ünvanı `localhost:9010`-dur — iOS simulyatoru buna çatır,
 * Android emulyatoru üçün `S3_PUBLIC_URL`/endpoint `10.0.2.2` olmalıdır.
 */
export async function uploadImage(asset: Asset, folder: UploadFolder): Promise<UploadedMedia> {
  if (!asset.uri) throw new ApiError(400, 'VALIDATION_FAILED', i18n.t('common:feedback.photoMissing'));

  const contentType = contentTypeOf(asset);
  const blob = await (await fetch(asset.uri)).blob();

  const presign = await api<{ mediaPublicId: string; uploadUrl: string }>('/media/presign', {
    method: 'POST',
    body: { contentType, sizeBytes: asset.fileSize ?? blob.size, folder },
  });

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!put.ok) throw new ApiError(put.status, 'UPLOAD_FAILED', i18n.t('common:feedback.photoUploadFailed'));

  return api<UploadedMedia>(`/media/${presign.mediaPublicId}/complete`, {
    method: 'POST',
    body: {
      ...(asset.width ? { width: asset.width } : {}),
      ...(asset.height ? { height: asset.height } : {}),
    },
  });
}

/** Qalereya seçimi üçün ortaq parametrlər — ölçü kiçildilir və JPEG-ə çevrilir (HEIC yox). */
export const PICKER_OPTIONS = {
  mediaType: 'photo',
  // PhotoQuality 0.1 addımlarla tiplənib
  quality: 0.8,
  maxWidth: 2048,
  maxHeight: 2048,
  assetRepresentationMode: 'compatible',
} as const;
