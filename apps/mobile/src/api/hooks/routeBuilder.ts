import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { RouteDetail } from '@/api/hooks/details';
import type { RouteSummary } from '@/api/hooks/content';
import type { XpReward } from '@/api/hooks/gamification';
import { meKeys } from '@/api/hooks/me';

/** `POST /routes` marşrut detalını + qazanılan XP-ni qaytarır (ekran 50 "+350 XP"). */
export interface CreatedRoute extends RouteDetail {
  rewards: XpReward;
}

export interface CreateRouteInput {
  title: string;
  region: string;
  days?: number;
  difficulty?: 'asan' | 'orta' | 'cetin';
  description?: string;
  isPublic?: boolean;
}

export interface AddStopInput {
  place: string;
  day?: number;
  arriveTime?: string;
  durationMin?: number;
  note?: string;
}

/** Öz marşrutların — şəxsi olanlar da daxil (ekran 14, 41 öz profilində, 50). */
export const useMyRoutes = (enabled = true) =>
  useQuery({
    queryKey: ['routes', 'mine'],
    queryFn: () => api<{ data: Array<RouteSummary & { visibility: string }>; nextOffset: number | null }>('/routes/mine'),
    enabled,
  });

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRouteInput) => api<CreatedRoute>('/routes', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

/**
 * Dayanacaq əməliyyatlarının hamısı yenilənmiş marşrut detalını qaytarır —
 * cavabı birbaşa keşə yazırıq ki, ekran 50 hər dəyişiklikdən sonra
 * yenidən sorğu göndərməsin.
 */
function useRouteMutation<TInput>(slug: string, request: (input: TInput) => Promise<RouteDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (detail) => {
      qc.setQueryData(['route', slug], detail);
      void qc.invalidateQueries({ queryKey: ['routes'] });
    },
  });
}

export const useUpdateRoute = (slug: string) =>
  useRouteMutation<Partial<CreateRouteInput>>(slug, (body) =>
    api<RouteDetail>(`/routes/${slug}`, { method: 'PATCH', body }),
  );

export const useAddStop = (slug: string) =>
  useRouteMutation<AddStopInput>(slug, (body) =>
    api<RouteDetail>(`/routes/${slug}/stops`, { method: 'POST', body }),
  );

export const useRemoveStop = (slug: string) =>
  useRouteMutation<number>(slug, (stopId) =>
    api<RouteDetail>(`/routes/${slug}/stops/${stopId}`, { method: 'DELETE' }),
  );

/** Sürüklə-burax əvəzinə yuxarı/aşağı düymələri — bütün sıra birdən göndərilir. */
export const useReorderStops = (slug: string) =>
  useRouteMutation<Array<{ stopId: number; day: number; order: number }>>(slug, (stops) =>
    api<RouteDetail>(`/routes/${slug}/stops/reorder`, { method: 'PUT', body: { stops } }),
  );

export const useDeleteRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api<{ deleted: boolean }>(`/routes/${slug}`, { method: 'DELETE' }),
    onSuccess: (_res, slug) => {
      qc.removeQueries({ queryKey: ['route', slug] });
      void qc.invalidateQueries({ queryKey: ['routes'] });
      // Profildəki "Marşrutlar" tabı və sayğaclar (`['user', username, 'routes']`)
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
    },
  });
};
