-- ═══════════════════════════════════════════════════════════════
--  1) İki sütunda `@map(...)` sətir şərhinin içində qalmışdı, ona görə
--     Prisma onları camelCase adla yaratmışdı. snake_case-ə gətirilir.
--  2) `payment_methods` xaricə ardıcıl `id` qaytarırdı — qalan bütün
--     resurslar ULID işlədir. `public_id` əlavə olunur və doldurulur.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE `payment_methods` CHANGE `providerToken` `provider_token` VARCHAR(255) NOT NULL;
ALTER TABLE `leaderboard_snapshots` CHANGE `periodKey` `period_key` VARCHAR(20) NOT NULL;

ALTER TABLE `payment_methods` ADD COLUMN `public_id` CHAR(26) NULL AFTER `id`;

-- Mövcud sətirlər üçün ULID-ə bənzər unikal dəyər (böyük hərfli Crockford base32).
UPDATE `payment_methods`
SET `public_id` = UPPER(
  CONCAT(
    LPAD(CONV(FLOOR(UNIX_TIMESTAMP(`created_at`) * 1000), 10, 32), 10, '0'),
    LPAD(CONV(FLOOR(RAND() * POW(2, 40)), 10, 32), 8, '0'),
    LPAD(CONV(`id`, 10, 32), 8, '0')
  )
)
WHERE `public_id` IS NULL;

ALTER TABLE `payment_methods` MODIFY `public_id` CHAR(26) NOT NULL;
CREATE UNIQUE INDEX `payment_methods_public_id_key` ON `payment_methods`(`public_id`);
