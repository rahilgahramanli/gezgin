import { Prisma } from '@prisma/client';

/**
 * MySQL coğrafi sorğu köməkçiləri.
 *
 * Prisma spatial tipləri dəstəkləmir — `geo POINT SRID 4326` sütunu əl
 * migration-ı ilə yaradılıb (bax: *_geo_spatial). Konvensiya: POINT(lng, lat).
 *
 * Yoxlanılıb: ST_MakeEnvelope coğrafi SRS üçün MySQL 8.4-də dəstəklənmir,
 * ona görə bbox `ST_GeomFromText(..., 4326, 'axis-order=long-lat')` ilə qurulur.
 */

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** İki nöqtə arasında metrlə məsafə — SELECT hissəsində istifadə olunur. */
export function distanceMeters(column: string, lng: number, lat: number): Prisma.Sql {
  return Prisma.sql`ST_Distance_Sphere(${Prisma.raw(column)}, ST_SRID(POINT(${lng}, ${lat}), 4326))`;
}

/** Radius filtri — spatial indeksdən istifadə etmək üçün əvvəlcə bbox daralması. */
export function withinRadius(column: string, lng: number, lat: number, radiusM: number): Prisma.Sql {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const box = withinBox(column, {
    minLng: lng - dLng,
    minLat: lat - dLat,
    maxLng: lng + dLng,
    maxLat: lat + dLat,
  });
  return Prisma.sql`${box} AND ${distanceMeters(column, lng, lat)} <= ${radiusM}`;
}

/** Xəritə görünüşü üçün bbox filtri. */
export function withinBox(column: string, b: BoundingBox): Prisma.Sql {
  const polygon =
    `POLYGON((${b.minLng} ${b.minLat}, ${b.maxLng} ${b.minLat}, ` +
    `${b.maxLng} ${b.maxLat}, ${b.minLng} ${b.maxLat}, ${b.minLng} ${b.minLat}))`;
  return Prisma.sql`MBRContains(ST_GeomFromText(${polygon}, 4326, 'axis-order=long-lat'), ${Prisma.raw(column)})`;
}

/** "12.4 km" kimi göstərmək üçün — ekran 11, 12. */
export function formatDistanceKm(meters: number | null): number | null {
  return meters === null ? null : Math.round((meters / 1000) * 10) / 10;
}

/**
 * Xəritə zoom səviyyəsinə görə klasterləmə şəbəkəsinin ölçüsü (dərəcə).
 * Aşağı zoom → böyük xanalar → az pin.
 */
export function clusterPrecision(zoom: number): number {
  if (zoom >= 13) return 0.005;
  if (zoom >= 11) return 0.02;
  if (zoom >= 9) return 0.08;
  if (zoom >= 7) return 0.25;
  return 1;
}
