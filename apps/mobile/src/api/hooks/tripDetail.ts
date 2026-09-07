import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface TripItem {
  itemId: number;
  type: 'place' | 'experience' | 'event' | 'custom';
  order: number;
  startTime: string | null;
  durationMin: number | null;
  note: string | null;
  isDone: boolean;
  target: {
    slug: string | null;
    name: string;
    lat: number | null;
    lng: number | null;
    imageUrl: string | null;
    priceAzn?: number;
  };
}

export interface TripDetail {
  publicId: string;
  title: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  coverUrl: string | null;
  fromRoute: { slug: string; title: string } | null;
  progress: { done: number; total: number; percent: number };
  itinerary: Array<{ day: number; date: string | null; title: string | null; items: TripItem[] }>;
  notes: Array<{ id: number; body: string; createdAt: string }>;
}

export const useTripDetail = (publicId: string) =>
  useQuery({ queryKey: ['trip', publicId], queryFn: () => api<TripDetail>(`/trips/${publicId}`) });

/** Ekran 23 — elementi tamamlandı işarələmək. */
export function useToggleTripItem(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, isDone }: { itemId: number; isDone: boolean }) =>
      api<TripDetail>(`/trips/${publicId}/items/${itemId}`, { method: 'PATCH', body: { isDone } }),
    onSuccess: (data) => {
      qc.setQueryData(['trip', publicId], data);
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export interface CreateTripInput {
  title: string;
  fromRoute?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  offlineEnabled?: boolean;
}

/** Ekran 24 — yeni səyahət. */
export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTripInput) => api<TripDetail>('/trips', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export interface AddItemInput {
  type: 'place' | 'experience' | 'event' | 'custom';
  slug?: string;
  title?: string;
  day?: number;
  startTime?: string;
  note?: string;
}

/** Ekran 48 — plana əlavə et. */
export function useAddTripItem(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddItemInput) =>
      api<TripDetail>(`/trips/${publicId}/items`, { method: 'POST', body }),
    onSuccess: (data) => {
      qc.setQueryData(['trip', publicId], data);
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useStartTrip(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<TripDetail>(`/trips/${publicId}/start`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(['trip', publicId], data);
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
