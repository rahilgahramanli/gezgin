import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface BusinessSummary {
  slug: string;
  name: string;
  type: string;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  packageCount: number;
  region: { slug: string; name: string };
  coverUrl: string | null;
}

export interface BusinessPackage {
  publicId: string;
  title: string;
  description: string | null;
  nights: number;
  days: number;
  priceAzn: number;
  pricePerNightAzn: number | null;
  includes: string[];
}

export interface BusinessDetail extends BusinessSummary {
  description: string | null;
  services: string[];
  reviewCount: number;
  phone: string | null;
  website: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
  photoCount: number;
  photos: Array<{ url: string | null; blurhash: string | null }>;
  packages: BusinessPackage[];
}

/** `region` — Kəşf et ekranının region çipi; verilməsə bütün bizneslər. */
export const useBusinesses = (params: { region?: string; type?: string } = {}) =>
  useQuery({
    queryKey: ['businesses', params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.region) qs.set('region', params.region);
      if (params.type) qs.set('type', params.type);
      const query = qs.toString();
      return api<{ data: BusinessSummary[]; nextOffset: number | null }>(`/businesses${query ? `?${query}` : ''}`);
    },
  });

export const useBusiness = (slug: string) =>
  useQuery({ queryKey: ['business', slug], queryFn: () => api<BusinessDetail>(`/businesses/${slug}`) });
