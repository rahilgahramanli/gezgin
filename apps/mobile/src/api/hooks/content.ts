import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

/** Səhifələnən cavabların ümumi forması. */
interface Paged<T> {
  data: T[];
  nextOffset: number | null;
}

export interface Region {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  placeCount: number;
  isFeatured: boolean;
  coverUrl: string | null;
}

export interface Place {
  slug: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  rating: number;
  ratingCount: number;
  entranceFeeAzn: number | null;
  region: { slug: string; name: string };
  coverUrl: string | null;
  distanceKm: number | null;
}

export interface RouteSummary {
  slug: string;
  title: string;
  days: number;
  nights: number;
  distanceKm: number | null;
  difficulty: string;
  stopCount: number;
  rating: number;
  ratingCount: number;
  isOfficial: boolean;
  coverUrl: string | null;
  region: { slug: string; name: string };
}

export interface ExperienceSummary {
  slug: string;
  title: string;
  durationText: string | null;
  priceAzn: number;
  rating: number;
  ratingCount: number;
  region: { slug: string; name: string };
  expert: { username: string; fullName: string; avatarUrl: string | null };
  coverUrl: string | null;
}

export const qs = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const useRegions = (featured?: boolean) =>
  useQuery({
    queryKey: ['regions', { featured }],
    queryFn: () => api<Region[]>(`/regions${qs({ featured })}`),
  });

export const usePlaces = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['places', params],
    queryFn: () => api<Paged<Place>>(`/places${qs(params)}`),
  });

/** Sonsuz sürüşdürmə — ekran 12 siyahısı. */
export const useInfinitePlaces = (params: Record<string, unknown> = {}) =>
  useInfiniteQuery({
    queryKey: ['places', 'infinite', params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<Paged<Place>>(`/places${qs({ ...params, offset: pageParam })}`),
    getNextPageParam: (last) => last.nextOffset,
  });

export const usePlace = (slug: string) =>
  useQuery({ queryKey: ['place', slug], queryFn: () => api<Record<string, never>>(`/places/${slug}`) });

export const useRoutes = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['routes', params],
    queryFn: () => api<Paged<RouteSummary>>(`/routes${qs(params)}`),
  });

export const useExperiences = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['experiences', params],
    queryFn: () => api<Paged<ExperienceSummary>>(`/experiences${qs(params)}`),
  });

export const useSearch = (q: string, params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['search', q, params],
    queryFn: () => api<{ query: string; total: number; results: SearchHit[] }>(`/search${qs({ q, ...params })}`),
    enabled: q.trim().length >= 2,
  });

export interface SearchHit {
  type: 'place' | 'route' | 'experience' | 'event' | 'user';
  slug: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  rating: number | null;
  priceAzn: number | null;
  distanceKm: number | null;
}

export interface Category {
  slug: string;
  /** Cari dilə uyğun ad — API `{az, en, ru}` qaytarır, burada düzləşdirilir. */
  name: string;
  icon: string | null;
  types: string[];
}

interface CategoryResponse {
  slug: string;
  name: { az: string; en: string; ru: string };
  icon: string | null;
  types: string[];
}

export const useCategoryList = (type?: string, lang: 'az' | 'en' | 'ru' = 'az') =>
  useQuery({
    queryKey: ['categories', type, lang],
    queryFn: async (): Promise<Category[]> => {
      const rows = await api<CategoryResponse[]>(`/categories${qs({ type })}`);
      return rows.map((c) => ({
        slug: c.slug,
        name: c.name[lang] ?? c.name.az ?? c.slug,
        icon: c.icon,
        types: c.types,
      }));
    },
  });

/** Ekran 12 xəritə rejimi — zoom 13-dən aşağıda klasterlər gəlir. */
export type MapResponse =
  | {
      mode: 'points';
      zoom: number;
      items: Array<{ slug: string; name: string; lat: number; lng: number; rating: number; category: string | null }>;
    }
  | {
      mode: 'clusters';
      zoom: number;
      precision: number;
      items: Array<{ count: number; lat: number; lng: number; sampleName: string }>;
    };

export const usePlacesMap = (params: { bbox?: string; zoom?: number; region?: string; categories?: string[] }) =>
  useQuery({
    queryKey: ['places', 'map', params],
    queryFn: () => api<MapResponse>(`/places/map${qs(params)}`),
  });
