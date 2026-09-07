-- ═══════════════════════════════════════════════════════════════
--  Azərbaycan dili üçün axtarış normalizasiyası
--
--  Problem: utf8mb4_0900_ai_ci ş/ç/ğ/ö/ü hərflərini s/c/g/o/u ilə
--  uyğunlaşdırır, AMMA `ə` (U+0259 schwa) və `ı` (U+0131 dotless i)
--  Unicode-da müstəqil hərflərdir — e və i ilə uyğunlaşmır.
--  Nəticədə "kend" yazan istifadəçi "Xınalıq kəndi"-ni tapmır.
--
--  Həll: hər axtarıla bilən mətn üçün ASCII-yə yaxınlaşdırılmış
--  `search_text` generated sütunu + FULLTEXT indeks.
--  API tərəfi istifadəçinin sorğusunu eyni qayda ilə normallaşdırır
--  (bax: apps/api/src/common/search/normalize.ts).
--
--  Sorğu nümunəsi (BOOLEAN MODE + prefiks — dil şəkilçilidir):
--    MATCH(search_text) AGAINST('kend* quba*' IN BOOLEAN MODE)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE `place_translations`
  ADD COLUMN `search_text` TEXT
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `name`, IFNULL(`description`, '')), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `place_translations` ADD FULLTEXT INDEX `ft_place_search` (`search_text`);

ALTER TABLE `region_translations`
  ADD COLUMN `search_text` TEXT
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `name`, IFNULL(`description`, '')), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `region_translations` ADD FULLTEXT INDEX `ft_region_search` (`search_text`);

ALTER TABLE `route_translations`
  ADD COLUMN `search_text` TEXT
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `title`, IFNULL(`description`, '')), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `route_translations` ADD FULLTEXT INDEX `ft_route_search` (`search_text`);

ALTER TABLE `experiences`
  ADD COLUMN `search_text` TEXT
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `title_az`, IFNULL(`description_az`, '')), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `experiences` ADD FULLTEXT INDEX `ft_experience_search` (`search_text`);

ALTER TABLE `events`
  ADD COLUMN `search_text` TEXT
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `title_az`, IFNULL(`description_az`, '')), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `events` ADD FULLTEXT INDEX `ft_event_search` (`search_text`);

ALTER TABLE `businesses`
  ADD COLUMN `search_text` TEXT
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `name`, IFNULL(`description_az`, '')), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `businesses` ADD FULLTEXT INDEX `ft_business_search` (`search_text`);

-- İstifadəçi axtarışı (ekran 11 "Gezginlər")
ALTER TABLE `users`
  ADD COLUMN `search_text` VARCHAR(300)
  GENERATED ALWAYS AS (
    LOWER(REPLACE(REPLACE(REPLACE(CONCAT_WS(' ', `full_name`, `username`), 'ə', 'e'), 'ı', 'i'), 'İ', 'i'))
  ) STORED;
ALTER TABLE `users` ADD FULLTEXT INDEX `ft_user_search` (`search_text`);
