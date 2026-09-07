-- ═══════════════════════════════════════════════════════════════
--  Coğrafi sütunlar və spatial indekslər
--
--  Prisma MySQL spatial tiplərini dəstəkləmir, ona görə `geo` sütunu
--  bu əl migration-ı ilə əlavə olunur. Sorğular $queryRaw ilə gedir:
--
--    SELECT id, ST_Distance_Sphere(geo, ST_SRID(POINT(?,?),4326)) AS dist
--    FROM places
--    WHERE MBRContains(ST_GeomFromText(?, 4326), geo)
--    ORDER BY dist LIMIT 20;
--
--  `geo` schema.prisma-da yer almır — Prisma onu tanımır.
--  `prisma migrate dev` bunu drift kimi görməsin deyə sütun yalnız
--  burada yaradılır və sxem dəyişəndə bu fayla toxunulmur.
-- ═══════════════════════════════════════════════════════════════

-- places: lat/lng məcburidir → geo NOT NULL
ALTER TABLE `places`
  ADD COLUMN `geo` POINT
  GENERATED ALWAYS AS (ST_SRID(POINT(`lng`, `lat`), 4326)) STORED NOT NULL;
ALTER TABLE `places` ADD SPATIAL INDEX `idx_places_geo` (`geo`);

-- Aşağıdakılarda lat/lng NULL ola bilər. Spatial index NULL qəbul etmir,
-- ona görə COALESCE ilə 0,0 (Null Adası) fallback verilir —
-- sorğularda mütləq `lat IS NOT NULL` şərti əlavə olunmalıdır.
ALTER TABLE `experiences`
  ADD COLUMN `geo` POINT
  GENERATED ALWAYS AS (ST_SRID(POINT(COALESCE(`lng`, 0), COALESCE(`lat`, 0)), 4326)) STORED NOT NULL;
ALTER TABLE `experiences` ADD SPATIAL INDEX `idx_experiences_geo` (`geo`);

ALTER TABLE `events`
  ADD COLUMN `geo` POINT
  GENERATED ALWAYS AS (ST_SRID(POINT(COALESCE(`lng`, 0), COALESCE(`lat`, 0)), 4326)) STORED NOT NULL;
ALTER TABLE `events` ADD SPATIAL INDEX `idx_events_geo` (`geo`);

ALTER TABLE `businesses`
  ADD COLUMN `geo` POINT
  GENERATED ALWAYS AS (ST_SRID(POINT(COALESCE(`lng`, 0), COALESCE(`lat`, 0)), 4326)) STORED NOT NULL;
ALTER TABLE `businesses` ADD SPATIAL INDEX `idx_businesses_geo` (`geo`);

ALTER TABLE `checkins`
  ADD COLUMN `geo` POINT
  GENERATED ALWAYS AS (ST_SRID(POINT(COALESCE(`lng`, 0), COALESCE(`lat`, 0)), 4326)) STORED NOT NULL;
ALTER TABLE `checkins` ADD SPATIAL INDEX `idx_checkins_geo` (`geo`);

ALTER TABLE `posts`
  ADD COLUMN `geo` POINT
  GENERATED ALWAYS AS (ST_SRID(POINT(COALESCE(`lng`, 0), COALESCE(`lat`, 0)), 4326)) STORED NOT NULL;
ALTER TABLE `posts` ADD SPATIAL INDEX `idx_posts_geo` (`geo`);
