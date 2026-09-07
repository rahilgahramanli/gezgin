import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export interface AppConfig {
  currency: string;
  languages: string[];
  platformCommissionRate: number;
  gamification: {
    maxLevel: number;
    levelXp: number[];
    tiers: Array<{ code: string; nameAz: string; fromLevel: number; toLevel: number }>;
    xpRules: Record<string, { xp: number; dailyCap: number | null; nameAz: string }>;
  };
  payments: { provider: string; isMock: boolean };
  featureFlags: Record<string, unknown>;
}

export interface Category {
  slug: string;
  name: { az: string; en: string; ru: string };
  icon: string | null;
  types: string[];
}

/** Açılışda bir dəfə çəkilir və uzun müddət keşlənir — sabitlər hardcode edilmir. */
export const useAppConfig = () =>
  useQuery({
    queryKey: ['config'],
    queryFn: () => api<AppConfig>('/config'),
    staleTime: 1000 * 60 * 60,
  });

export const useCategories = (type?: string) =>
  useQuery({
    queryKey: ['categories', type],
    queryFn: () => api<Category[]>(`/categories${type ? `?type=${type}` : ''}`),
    staleTime: 1000 * 60 * 60,
  });
