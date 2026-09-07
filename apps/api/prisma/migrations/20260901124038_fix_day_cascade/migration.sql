-- ═══════════════════════════════════════════════════════════════
--  Gün əlaqələri: SET NULL → CASCADE
--
--  Problem: MySQL eyni cədvəli iki fərqli kaskad yolu ilə dəyişdirməyə
--  icazə vermir. `trips` silinəndə həm `trip_days` (CASCADE), həm də
--  `trip_items` (CASCADE) silinirdi; eyni zamanda `trip_days`-dən
--  `trip_items.trip_day_id`-yə SET NULL gəlirdi — MySQL silinməkdə olan
--  sətirləri yeniləməyə çalışıb `ERROR 1452` verirdi.
--
--  Bu, istifadəçi hesabının silinməsini də bloklayırdı:
--  users → trips → trip_days + trip_items.
--
--  Həll: gün əlaqəsi də CASCADE olur. Günü tək-tək silərkən elementlər
--  əvvəlcə başqa günə köçürülür (TripsService.removeDay, RoutesService).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE `trip_items` DROP FOREIGN KEY `trip_items_trip_day_id_fkey`;
ALTER TABLE `trip_items`
  ADD CONSTRAINT `trip_items_trip_day_id_fkey`
  FOREIGN KEY (`trip_day_id`) REFERENCES `trip_days`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `route_stops` DROP FOREIGN KEY `route_stops_route_day_id_fkey`;
ALTER TABLE `route_stops`
  ADD CONSTRAINT `route_stops_route_day_id_fkey`
  FOREIGN KEY (`route_day_id`) REFERENCES `route_days`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
