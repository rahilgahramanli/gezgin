import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import { api } from '@/api/client';
import { useAuth } from '@/store/auth';
import { alertError } from '@/lib/errors';

export interface MeProfile {
  publicId: string;
  username: string;
  fullName: string;
  email: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  role: string;
  homeRegion: { slug: string; name: string } | null;
  interests: Array<{ slug: string; name: string; icon: string | null }>;
  gamification: {
    level: number;
    tier: string;
    xp: number;
    xpInLevel: number;
    xpForLevel: number;
    xpToNext: number;
    percent: number;
    gezginScore: number;
  };
  onboardingCompleted: boolean;
}

export interface MeStats {
  regions: number;
  regionsTotal: number;
  places: number;
  experiences: number;
  routes: number;
  wantToGo: number;
  reviews: number;
  posts: number;
  followers: number;
  following: number;
  badges: number;
  score: number;
}

export const meKeys = {
  profile: ['me'] as const,
  stats: ['me', 'stats'] as const,
  score: ['me', 'score'] as const,
  badges: ['me', 'badges'] as const,
  regions: ['me', 'regions'] as const,
};

export const useMe = () =>
  useQuery({ queryKey: meKeys.profile, queryFn: () => api<MeProfile>('/me') });

export const useMyStats = () =>
  useQuery({ queryKey: meKeys.stats, queryFn: () => api<MeStats>('/me/stats') });

/**
 * Maraqlar yadda saxlanılır, amma onboarding hələ bitmir — ekran 39 (foto, bio,
 * icazələr) ondan sonra gəlir. Bayraq yalnız son addımda qaldırılır.
 */
export function useSetInterests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slugs: string[]) =>
      api<Array<{ slug: string; name: string }>>('/me/interests', { method: 'PUT', body: { slugs } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<MeProfile>('/me', { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}

/** Ekran 34 — tənzimləmələr. Server defoltları `upsert` ilə yaradır. */
export interface UserSettings {
  /** Server sahəni `language` adlandırır — `lang` 400 qaytarır. */
  language: 'az' | 'en' | 'ru';
  darkMode: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  locationEnabled: boolean;
  wifiOnlyDownload: boolean;
  profileVisibility: 'public' | 'followers' | 'private';
}

export const useSettings = () =>
  useQuery({ queryKey: ['me', 'settings'], queryFn: () => api<UserSettings>('/me/settings') });

/**
 * Tənzimləmə dəyişikliyi dərhal görünür: açar geri "sıçramasın" deyə keş
 * optimistik yenilənir, xəta olanda əvvəlki vəziyyət qaytarılır.
 */
export function useUpdateSettings() {
  const qc = useQueryClient();
  const key = ['me', 'settings'];
  return useMutation({
    mutationFn: (body: Partial<UserSettings>) =>
      api<UserSettings>('/me/settings', { method: 'PATCH', body }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<UserSettings>(key);
      qc.setQueryData(key, (old?: UserSettings) => (old ? { ...old, ...body } : old));
      return { previous };
    },
    onError: (error, _body, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      alertError(error, i18n.t('common:feedback.settingsNotSaved'));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

/** Avatar/cover — media əvvəlcə yüklənir, sonra profilə bağlanır. */
export function useSetProfileMedia(kind: 'avatar' | 'cover') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mediaPublicId: string) =>
      api<MeProfile>(`/me/${kind}`, { method: 'POST', body: { mediaPublicId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: meKeys.profile }),
    onError: (error) => alertError(error, i18n.t('common:feedback.photoNotSet')),
  });
}

export const useBlockedUsers = () =>
  useQuery({
    queryKey: ['me', 'blocked'],
    queryFn: () => api<Array<{ username: string; fullName: string; avatarUrl: string | null; blockedAt: string }>>('/me/blocked'),
  });

export function useUnblock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => api(`/me/blocked/${username}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me', 'blocked'] }),
    onError: (error) => alertError(error, i18n.t('common:feedback.unblockFailed')),
  });
}

/** Hesabın silinməsi — App Store 5.1.1(v) tələbi. Məlumatlar anonimləşdirilir. */
export function useDeleteAccount() {
  const signOut = useAuth((s) => s.signOut);
  return useMutation({
    mutationFn: () => api('/me', { method: 'DELETE' }),
    onSuccess: () => signOut(),
    onError: (error) => alertError(error, i18n.t('common:feedback.deleteAccountFailed')),
  });
}

/** Ekran 32 — region tərəqqisi: neçə region kəşf edilib. */
export interface RegionProgress {
  discovered: number;
  total: number;
  percent: number;
  regions: Array<{
    slug: string;
    name: string;
    coverUrl: string | null;
    placeCount: number;
    visitedPlaces: number;
    lastVisit: string | null;
    percent: number;
    discovered: boolean;
  }>;
}

export const useRegionProgress = () =>
  useQuery({ queryKey: meKeys.regions, queryFn: () => api<RegionProgress>('/me/regions') });
