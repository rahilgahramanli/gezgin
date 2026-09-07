import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/store/auth';

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

export function useSetInterests() {
  const qc = useQueryClient();
  const patchUser = useAuth((s) => s.patchUser);
  return useMutation({
    mutationFn: (slugs: string[]) =>
      api<Array<{ slug: string; name: string }>>('/me/interests', { method: 'PUT', body: { slugs } }),
    onSuccess: () => {
      patchUser({ onboardingCompleted: true });
      void qc.invalidateQueries({ queryKey: meKeys.profile });
    },
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<MeProfile>('/me', { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: meKeys.profile }),
  });
}
