import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { meKeys } from './me';

/** Ekran 29 — Gezgin Score kartı. */
export interface ScoreData {
  gezginScore: number;
  trendPercent: number | null;
  level: number;
  tier: string;
  xp: number;
  xpInLevel: number;
  xpForLevel: number;
  xpToNext: number;
  percent: number;
  last30Days: { xp: number; scoreDelta: number };
  earnRules: Array<{ action: string; name: string; xp: number; dailyCap: number | null }>;
}

/** Ekran 30 — nailiyyətlər. */
export interface BadgeData {
  earnedCount: number;
  totalCount: number;
  badges: Array<{
    slug: string;
    name: string;
    description: string | null;
    conditionValue: number;
    progress: number;
    percent: number;
    earned: boolean;
  }>;
}

/** Ekran 31 — liderlər cədvəli. */
export interface LeaderboardData {
  period: string;
  podium: LeaderboardEntry[];
  entries: LeaderboardEntry[];
  me: (LeaderboardEntry & { rankChange: number | null }) | null;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  fullName: string;
  level: number;
  isLocalExpert: boolean;
  avatarUrl: string | null;
  points: number;
  isMe: boolean;
}

export const useScore = () => useQuery({ queryKey: meKeys.score, queryFn: () => api<ScoreData>('/me/score') });

export const useBadges = () => useQuery({ queryKey: meKeys.badges, queryFn: () => api<BadgeData>('/me/badges') });

export const useLeaderboard = (period: 'weekly' | 'monthly' | 'all_time' = 'weekly') =>
  useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api<LeaderboardData>(`/leaderboard?period=${period}`),
  });

/**
 * XP verən hər əməliyyat (check-in, marşrut yaratma, rezervasiya) cavabında
 * eyni bloku qaytarır — ekran 52 və 50 bunu göstərir.
 */
export interface XpReward {
  xpGained: number;
  scoreDelta: number;
  gezginScore: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  tier: string;
  xpToNext: number;
  percent: number;
  cappedByDailyLimit: boolean;
  newBadges: Array<{ slug: string; name: string; description: string | null }>;
}

/** Ekran 51 → 52 — check-in və XP mükafatı. */
export interface CheckinResult {
  place: { slug: string; name: string; region: { name: string } };
  isFirstVisit: boolean;
  distanceM: number | null;
  rewards: XpReward;
  trip: { publicId: string; done: number; total: number; percent: number } | null;
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { place: string; lat?: number; lng?: number; trip?: string }) =>
      api<CheckinResult>('/checkins', { method: 'POST', body }),
    onSuccess: () => {
      // Check-in profil statistikasını, score-u və səyahət tərəqqisini dəyişir
      void qc.invalidateQueries({ queryKey: meKeys.profile });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
      void qc.invalidateQueries({ queryKey: meKeys.score });
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
