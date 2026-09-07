import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface TripSummary {
  publicId: string;
  title: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  dayCount: number;
  itemCount: number;
  doneCount: number;
  progressPercent: number;
  coverUrl: string | null;
  fromRoute: { slug: string; title: string } | null;
}

export const useTrips = (status?: string) =>
  useQuery({
    queryKey: ['trips', status],
    queryFn: () =>
      api<{ data: TripSummary[]; nextOffset: number | null }>(
        `/trips${status ? `?status=${status}` : ''}`,
      ),
  });
