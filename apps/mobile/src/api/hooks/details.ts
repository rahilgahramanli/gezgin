import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { alertError } from '@/lib/errors';

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
  /** Cari istifadəçi saxlayıb? Qonaq üçün həmişə false. */
  isSaved: boolean;
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
  isSaved: boolean;
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
  isSaved: boolean;
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

export type SavedType = 'place' | 'route' | 'experience';

/**
 * Saxlanılanlar — bookmark düyməsi (ekran 13, 15, 17, 33).
 * `mutate(true)` saxlayır, `mutate(false)` götürür; detal keşi dərhal yenilənir,
 * xəta olsa əvvəlki vəziyyət geri qaytarılır.
 */
export function useToggleSaved(type: SavedType, slug: string) {
  const qc = useQueryClient();
  const key = [type, slug];

  return useMutation({
    mutationFn: (next: boolean) =>
      next
        ? api('/saved', { method: 'POST', body: { type, target: slug } })
        : api(`/saved/${type}/${slug}`, { method: 'DELETE' }),
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ isSaved: boolean }>(key);
      qc.setQueryData(key, (old?: { isSaved: boolean }) => (old ? { ...old, isSaved: next } : old));
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      alertError(error, 'Saxlanılmadı');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['saved'] });
    },
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

/** Ekran 46 — məkanın bütün fotoları (rəsmi + icma). */
export interface PlacePhotos {
  counts: { all: number; official: number; community: number };
  data: Array<{
    mediaPublicId: string;
    url: string | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
    isOfficial: boolean;
    uploadedBy: { username: string; fullName: string; avatarUrl: string | null } | null;
  }>;
}

export const usePlacePhotos = (slug: string, filter?: 'official' | 'community') =>
  useQuery({
    queryKey: ['place', slug, 'photos', filter],
    queryFn: () => api<PlacePhotos>(`/places/${slug}/photos?limit=60${filter ? `&filter=${filter}` : ''}`),
  });

export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful';

export interface ReviewRow {
  publicId: string;
  rating: number;
  body: string | null;
  tags?: string[];
  createdAt: string;
  author: { username: string; fullName: string; level: number; avatarUrl: string | null; isLocalExpert: boolean };
  helpfulCount?: number;
  markedHelpful?: boolean;
  isMine?: boolean;
  photos?: Array<{ url: string | null; blurhash: string | null }>;
}

/**
 * Rəyi "faydalı" işarələ / geri al — optimistik: say və vəziyyət dərhal dəyişir,
 * xəta olanda siyahı serverdən yenidən yüklənir.
 */
export function useToggleHelpful(targetType: string, target: string) {
  const qc = useQueryClient();
  const key = ['reviews', targetType, target];
  return useMutation({
    mutationFn: ({ publicId, helpful }: { publicId: string; helpful: boolean }) =>
      api<{ markedHelpful: boolean; helpfulCount: number }>(`/reviews/${publicId}/helpful`, {
        method: helpful ? 'POST' : 'DELETE',
      }),
    onMutate: ({ publicId, helpful }) => {
      qc.setQueriesData<{ total: number; data: ReviewRow[] }>({ queryKey: key }, (d) =>
        d && Array.isArray(d.data)
          ? {
              ...d,
              data: d.data.map((r) =>
                r.publicId === publicId
                  ? { ...r, markedHelpful: helpful, helpfulCount: Math.max(0, (r.helpfulCount ?? 0) + (helpful ? 1 : -1)) }
                  : r,
              ),
            }
          : d,
      );
    },
    onError: (e) => {
      alertError(e, 'Alınmadı');
      void qc.invalidateQueries({ queryKey: key });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...key, 'all', 'helpful'] }),
  });
}

/** Ekran 47 — bütün rəylər, sıralama və səhifələmə ilə. */
export const useAllReviews = (targetType: string, target: string, sort: ReviewSort) =>
  useQuery({
    queryKey: ['reviews', targetType, target, 'all', sort],
    queryFn: () =>
      api<{ total: number; data: ReviewRow[] }>(
        `/reviews?targetType=${targetType}&target=${target}&sort=${sort}&limit=50`,
      ),
  });

/** Ekran 45 — filtr panelinin seçimləri serverdən gəlir (kateqoriyalar, qiymət, məsafə). */
export interface PlaceFilters {
  categories: Array<{ slug: string; name: string; icon: string | null }>;
  ratings: number[];
  priceLevels: Array<{ level: number; label: string }>;
  distanceKm: { min: number; max: number; default: number };
  totalPlaces: number;
  maxEntranceFeeAzn: number | null;
}

export const usePlaceFilters = (region?: string) =>
  useQuery({
    queryKey: ['places', 'filters', region],
    queryFn: () => api<PlaceFilters>(`/places/filters${region ? `?region=${region}` : ''}`),
  });
