import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

/** Ekran 13 — məkan detalı. */
export interface PlaceDetail {
  slug: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  altitudeM: number | null;
  address: string | null;
  bestSeason: string | null;
  visitDurationH: number | null;
  entranceFeeAzn: number | null;
  rating: number;
  ratingCount: number;
  reviewCount: number;
  checkinCount: number;
  photoCount: number;
  region: { slug: string; name: string };
  categories: Array<{ slug: string; name: string; icon: string | null }>;
  photos: Array<{ url: string | null; blurhash: string | null }>;
}

/** Ekran 15 — marşrut detalı. */
export interface RouteDetail {
  slug: string;
  title: string;
  description: string | null;
  days: number;
  nights: number;
  distanceKm: number | null;
  difficulty: string;
  stopCount: number;
  rating: number;
  ratingCount: number;
  copyCount: number;
  isOfficial: boolean;
  isOwner: boolean;
  /** `private` marşrutu yalnız sahibi görür — ekran 50 toggle-ı bunu dəyişir. */
  visibility: 'private' | 'public' | 'official';
  coverUrl: string | null;
  region: { slug: string; name: string };
  author: { username: string; fullName: string; avatarUrl: string | null } | null;
  itinerary: Array<{
    day: number;
    title: string | null;
    stops: Array<{
      stopId: number;
      order: number;
      arriveTime: string | null;
      durationMin: number | null;
      place: { slug: string; name: string; lat: number; lng: number; rating: number; coverUrl: string | null };
    }>;
  }>;
}

/** Ekran 17 — təcrübə detalı. */
export interface ExperienceDetail {
  slug: string;
  title: string;
  description: string | null;
  durationText: string | null;
  maxGroup: number;
  meetingPoint: string | null;
  rating: number;
  ratingCount: number;
  reviewCount: number;
  pricing: {
    priceAzn: number;
    expertEarnsAzn: number;
    platformFeeAzn: number;
    expertRate: number;
    platformRate: number;
  };
  gezginRewards: { experienceXp: number; bookingXp: number; reviewXp: number };
  region: { slug: string; name: string };
  includes: Array<{ code: string; name: string }>;
  photos: Array<{ url: string | null }>;
  expert: {
    username: string;
    fullName: string;
    bio: string | null;
    avatarUrl: string | null;
    rating: number;
    ratingCount: number;
    experienceCount: number;
    languages: string[];
  };
  nextAvailable: { startAt: string; seatsLeft: number } | null;
}

export const usePlaceDetail = (slug: string) =>
  useQuery({ queryKey: ['place', slug], queryFn: () => api<PlaceDetail>(`/places/${slug}`) });

export const useRouteDetail = (slug: string) =>
  useQuery({ queryKey: ['route', slug], queryFn: () => api<RouteDetail>(`/routes/${slug}`) });

export const useExperienceDetail = (slug: string) =>
  useQuery({ queryKey: ['experience', slug], queryFn: () => api<ExperienceDetail>(`/experiences/${slug}`) });

export const useNearbyPlaces = (slug: string) =>
  useQuery({
    queryKey: ['place', slug, 'nearby'],
    queryFn: () =>
      api<Array<{ slug: string; name: string; coverUrl: string | null; distanceKm: number | null; rating: number }>>(
        `/places/${slug}/nearby?limit=6`,
      ),
  });

/** Rəylər — ekran 13 və 47. */
export const useReviews = (targetType: string, target: string) =>
  useQuery({
    queryKey: ['reviews', targetType, target],
    queryFn: () =>
      api<{
        data: Array<{
          publicId: string;
          rating: number;
          body: string | null;
          createdAt: string;
          author: { username: string; fullName: string; level: number; avatarUrl: string | null; isLocalExpert: boolean };
        }>;
      }>(`/reviews?targetType=${targetType}&target=${target}&limit=5`),
  });

export const useReviewSummary = (targetType: string, target: string) =>
  useQuery({
    queryKey: ['reviews', targetType, target, 'summary'],
    queryFn: () =>
      api<{ average: number; total: number; breakdown: Array<{ star: number; count: number; percent: number }> }>(
        `/reviews/summary?targetType=${targetType}&target=${target}`,
      ),
  });

/** Saxlanılanlar — bookmark düyməsi (ekran 13, 33). */
export function useToggleSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, target, saved }: { type: string; target: string; saved: boolean }) =>
      saved
        ? api(`/saved/${type}/${target}`, { method: 'DELETE' })
        : api('/saved', { method: 'POST', body: { type, target } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}

export const useSaved = (type?: string) =>
  useQuery({
    queryKey: ['saved', type],
    queryFn: () =>
      api<{
        counts: Record<string, number>;
        data: Array<{
          savedId: number;
          type: string;
          slug: string;
          title: string;
          subtitle: string | null;
          imageUrl: string | null;
          rating: number | null;
          priceAzn: number | null;
        }>;
      }>(`/saved${type ? `?type=${type}` : ''}`),
  });
