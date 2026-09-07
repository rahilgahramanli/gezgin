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

export const useBusinesses = () =>
  useQuery({
    queryKey: ['businesses'],
    queryFn: () => api<{ data: BusinessSummary[] }>('/businesses'),
  });

export const useBusiness = (slug: string) =>
  useQuery({ queryKey: ['business', slug], queryFn: () => api<BusinessDetail>(`/businesses/${slug}`) });
