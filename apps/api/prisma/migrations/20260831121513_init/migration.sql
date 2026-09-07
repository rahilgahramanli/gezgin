-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `username` VARCHAR(32) NOT NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(24) NULL,
    `password_hash` VARCHAR(255) NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `bio` VARCHAR(300) NULL,
    `gender` ENUM('female', 'male', 'other', 'unspecified') NOT NULL DEFAULT 'unspecified',
    `birth_date` DATE NULL,
    `role` ENUM('gezgin', 'local_expert', 'business', 'admin') NOT NULL DEFAULT 'gezgin',
    `status` ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
    `avatar_id` BIGINT UNSIGNED NULL,
    `cover_id` BIGINT UNSIGNED NULL,
    `home_region_id` BIGINT UNSIGNED NULL,
    `level` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `xp` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `gezgin_score` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `email_verified_at` DATETIME(3) NULL,
    `phone_verified_at` DATETIME(3) NULL,
    `last_active_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_public_id_key`(`public_id`),
    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_role_status_idx`(`role`, `status`),
    INDEX `users_home_region_id_idx`(`home_region_id`),
    INDEX `users_gezgin_score_idx`(`gezgin_score` DESC),
    INDEX `users_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `language` ENUM('az', 'en', 'ru') NOT NULL DEFAULT 'az',
    `currency` CHAR(3) NOT NULL DEFAULT 'AZN',
    `dark_mode` BOOLEAN NOT NULL DEFAULT false,
    `push_enabled` BOOLEAN NOT NULL DEFAULT true,
    `email_enabled` BOOLEAN NOT NULL DEFAULT true,
    `location_enabled` BOOLEAN NOT NULL DEFAULT true,
    `wifi_only_download` BOOLEAN NOT NULL DEFAULT true,
    `profile_visibility` ENUM('public', 'followers', 'private') NOT NULL DEFAULT 'public',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_interests` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_interests_category_id_idx`(`category_id`),
    PRIMARY KEY (`user_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_codes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `target` VARCHAR(190) NOT NULL,
    `channel` ENUM('email', 'sms') NOT NULL,
    `purpose` ENUM('register', 'login', 'password_reset', 'email_change', 'phone_change') NOT NULL,
    `code_hash` VARCHAR(255) NOT NULL,
    `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_codes_target_purpose_expires_at_idx`(`target`, `purpose`, `expires_at`),
    INDEX `otp_codes_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `family` CHAR(26) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `ip` VARCHAR(45) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    INDEX `refresh_tokens_family_idx`(`family`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `platform` ENUM('ios', 'android', 'web') NOT NULL,
    `push_token` VARCHAR(255) NOT NULL,
    `app_version` VARCHAR(24) NULL,
    `locale` VARCHAR(10) NULL,
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `devices_platform_idx`(`platform`),
    UNIQUE INDEX `devices_user_id_push_token_key`(`user_id`, `push_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follows` (
    `follower_id` BIGINT UNSIGNED NOT NULL,
    `following_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `follows_following_id_created_at_idx`(`following_id`, `created_at`),
    PRIMARY KEY (`follower_id`, `following_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocks` (
    `blocker_id` BIGINT UNSIGNED NOT NULL,
    `blocked_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `blocks_blocked_id_idx`(`blocked_id`),
    PRIMARY KEY (`blocker_id`, `blocked_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `cover_id` BIGINT UNSIGNED NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `place_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `regions_public_id_key`(`public_id`),
    UNIQUE INDEX `regions_slug_key`(`slug`),
    INDEX `regions_parent_id_idx`(`parent_id`),
    INDEX `regions_is_featured_sort_order_idx`(`is_featured`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `region_translations` (
    `region_id` BIGINT UNSIGNED NOT NULL,
    `lang` ENUM('az', 'en', 'ru') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,

    FULLTEXT INDEX `region_translations_name_description_idx`(`name`, `description`),
    PRIMARY KEY (`region_id`, `lang`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(60) NOT NULL,
    `name_az` VARCHAR(80) NOT NULL,
    `name_en` VARCHAR(80) NOT NULL,
    `name_ru` VARCHAR(80) NOT NULL,
    `icon` VARCHAR(60) NULL,
    `types` VARCHAR(120) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_is_active_sort_order_idx`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `places` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `created_by_id` BIGINT UNSIGNED NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `altitude_m` SMALLINT NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(24) NULL,
    `website` VARCHAR(190) NULL,
    `best_season` VARCHAR(60) NULL,
    `visit_duration_h` DECIMAL(4, 1) NULL,
    `entrance_fee_azn` DECIMAL(8, 2) NULL,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `save_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `checkin_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `places_public_id_key`(`public_id`),
    UNIQUE INDEX `places_slug_key`(`slug`),
    INDEX `places_region_id_status_idx`(`region_id`, `status`),
    INDEX `places_is_featured_rating_avg_idx`(`is_featured`, `rating_avg` DESC),
    INDEX `places_lat_lng_idx`(`lat`, `lng`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_translations` (
    `place_id` BIGINT UNSIGNED NOT NULL,
    `lang` ENUM('az', 'en', 'ru') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,

    FULLTEXT INDEX `place_translations_name_description_idx`(`name`, `description`),
    PRIMARY KEY (`place_id`, `lang`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_photos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `place_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `uploaded_by_id` BIGINT UNSIGNED NULL,
    `is_official` BOOLEAN NOT NULL DEFAULT false,
    `is_cover` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `place_photos_place_id_is_cover_sort_order_idx`(`place_id`, `is_cover`, `sort_order`),
    INDEX `place_photos_media_id_idx`(`media_id`),
    INDEX `place_photos_uploaded_by_id_idx`(`uploaded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_categories` (
    `place_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `place_categories_category_id_idx`(`category_id`),
    PRIMARY KEY (`place_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `category` ENUM('festival', 'konsert', 'sergi', 'idman', 'diger') NOT NULL DEFAULT 'festival',
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    `title_az` VARCHAR(160) NOT NULL,
    `title_en` VARCHAR(160) NULL,
    `description_az` TEXT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `start_time` VARCHAR(5) NULL,
    `end_time` VARCHAR(5) NULL,
    `venue` VARCHAR(190) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `is_free` BOOLEAN NOT NULL DEFAULT true,
    `price_azn` DECIMAL(8, 2) NULL,
    `organizer` VARCHAR(160) NULL,
    `cover_id` BIGINT UNSIGNED NULL,
    `attendee_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `events_public_id_key`(`public_id`),
    UNIQUE INDEX `events_slug_key`(`slug`),
    INDEX `events_region_id_start_date_idx`(`region_id`, `start_date`),
    INDEX `events_start_date_end_date_idx`(`start_date`, `end_date`),
    INDEX `events_category_status_idx`(`category`, `status`),
    FULLTEXT INDEX `events_title_az_description_az_idx`(`title_az`, `description_az`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_attendees` (
    `event_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_attendees_user_id_idx`(`user_id`),
    PRIMARY KEY (`event_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `businesses` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `owner_id` BIGINT UNSIGNED NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('otel', 'restoran', 'qonaq_evi', 'tur_sirketi', 'diger') NOT NULL DEFAULT 'otel',
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    `name` VARCHAR(160) NOT NULL,
    `description_az` TEXT NULL,
    `services` VARCHAR(255) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(24) NULL,
    `website` VARCHAR(190) NULL,
    `cover_id` BIGINT UNSIGNED NULL,
    `logo_id` BIGINT UNSIGNED NULL,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `businesses_public_id_key`(`public_id`),
    UNIQUE INDEX `businesses_slug_key`(`slug`),
    INDEX `businesses_region_id_type_status_idx`(`region_id`, `type`, `status`),
    INDEX `businesses_owner_id_idx`(`owner_id`),
    FULLTEXT INDEX `businesses_name_description_az_idx`(`name`, `description_az`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_packages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `business_id` BIGINT UNSIGNED NOT NULL,
    `title_az` VARCHAR(160) NOT NULL,
    `description_az` TEXT NULL,
    `nights` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `days` TINYINT UNSIGNED NOT NULL DEFAULT 2,
    `price_azn` DECIMAL(10, 2) NOT NULL,
    `includes` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `business_packages_public_id_key`(`public_id`),
    INDEX `business_packages_business_id_is_active_sort_order_idx`(`business_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_photos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `business_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `business_photos_business_id_sort_order_idx`(`business_id`, `sort_order`),
    INDEX `business_photos_media_id_idx`(`media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `author_id` BIGINT UNSIGNED NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `visibility` ENUM('private', 'public', 'official') NOT NULL DEFAULT 'public',
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    `days` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `nights` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `distance_km` DECIMAL(7, 2) NULL,
    `difficulty` ENUM('asan', 'orta', 'cetin') NOT NULL DEFAULT 'asan',
    `categories` VARCHAR(160) NULL,
    `cover_id` BIGINT UNSIGNED NULL,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `copy_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `save_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `routes_public_id_key`(`public_id`),
    UNIQUE INDEX `routes_slug_key`(`slug`),
    INDEX `routes_region_id_visibility_status_idx`(`region_id`, `visibility`, `status`),
    INDEX `routes_author_id_idx`(`author_id`),
    INDEX `routes_rating_avg_idx`(`rating_avg` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_translations` (
    `route_id` BIGINT UNSIGNED NOT NULL,
    `lang` ENUM('az', 'en', 'ru') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,

    FULLTEXT INDEX `route_translations_title_description_idx`(`title`, `description`),
    PRIMARY KEY (`route_id`, `lang`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_days` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `route_id` BIGINT UNSIGNED NOT NULL,
    `day_number` TINYINT UNSIGNED NOT NULL,
    `title_az` VARCHAR(160) NULL,
    `note_az` TEXT NULL,

    UNIQUE INDEX `route_days_route_id_day_number_key`(`route_id`, `day_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_stops` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `route_id` BIGINT UNSIGNED NOT NULL,
    `route_day_id` BIGINT UNSIGNED NULL,
    `place_id` BIGINT UNSIGNED NOT NULL,
    `day_number` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `arrive_time` VARCHAR(5) NULL,
    `duration_min` SMALLINT UNSIGNED NULL,
    `note_az` VARCHAR(500) NULL,

    INDEX `route_stops_place_id_idx`(`place_id`),
    INDEX `route_stops_route_day_id_idx`(`route_day_id`),
    UNIQUE INDEX `route_stops_route_id_day_number_sort_order_key`(`route_id`, `day_number`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expert_profiles` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `headline_az` VARCHAR(190) NULL,
    `bio_az` TEXT NULL,
    `specialties` VARCHAR(255) NULL,
    `languages` VARCHAR(60) NULL,
    `regions` VARCHAR(255) NULL,
    `years_active` TINYINT UNSIGNED NULL,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `experience_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `payout_rate` DECIMAL(4, 3) NOT NULL DEFAULT 0.80,
    `is_accepting_bookings` BOOLEAN NOT NULL DEFAULT true,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expert_profiles_rating_avg_idx`(`rating_avg` DESC),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiences` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `expert_id` BIGINT UNSIGNED NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `place_id` BIGINT UNSIGNED NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    `title_az` VARCHAR(160) NOT NULL,
    `title_en` VARCHAR(160) NULL,
    `description_az` TEXT NULL,
    `duration` ENUM('two_hours', 'half_day', 'full_day', 'multi_day') NOT NULL DEFAULT 'half_day',
    `duration_text` VARCHAR(40) NULL,
    `price_azn` DECIMAL(10, 2) NOT NULL,
    `max_group` TINYINT UNSIGNED NOT NULL DEFAULT 10,
    `min_group` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `meeting_point` VARCHAR(255) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `booking_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `experiences_public_id_key`(`public_id`),
    UNIQUE INDEX `experiences_slug_key`(`slug`),
    INDEX `experiences_region_id_status_idx`(`region_id`, `status`),
    INDEX `experiences_expert_id_status_idx`(`expert_id`, `status`),
    INDEX `experiences_is_featured_rating_avg_idx`(`is_featured`, `rating_avg` DESC),
    FULLTEXT INDEX `experiences_title_az_description_az_idx`(`title_az`, `description_az`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_photos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `experience_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `is_cover` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `experience_photos_experience_id_is_cover_sort_order_idx`(`experience_id`, `is_cover`, `sort_order`),
    INDEX `experience_photos_media_id_idx`(`media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_slots` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `experience_id` BIGINT UNSIGNED NOT NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NULL,
    `capacity` TINYINT UNSIGNED NOT NULL DEFAULT 10,
    `booked` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `price_azn` DECIMAL(10, 2) NULL,
    `is_cancelled` BOOLEAN NOT NULL DEFAULT false,

    INDEX `experience_slots_start_at_idx`(`start_at`),
    UNIQUE INDEX `experience_slots_experience_id_start_at_key`(`experience_id`, `start_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_inclusions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `experience_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name_az` VARCHAR(80) NOT NULL,
    `icon` VARCHAR(60) NULL,
    `is_included` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `experience_inclusions_experience_id_code_key`(`experience_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trips` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `route_id` BIGINT UNSIGNED NULL,
    `title` VARCHAR(160) NOT NULL,
    `status` ENUM('planned', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `travelers` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `cover_id` BIGINT UNSIGNED NULL,
    `offline_enabled` BOOLEAN NOT NULL DEFAULT false,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `trips_public_id_key`(`public_id`),
    INDEX `trips_user_id_status_start_date_idx`(`user_id`, `status`, `start_date`),
    INDEX `trips_route_id_idx`(`route_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_days` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `day_number` TINYINT UNSIGNED NOT NULL,
    `date` DATE NULL,
    `title_az` VARCHAR(160) NULL,

    UNIQUE INDEX `trip_days_trip_id_day_number_key`(`trip_id`, `day_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `trip_day_id` BIGINT UNSIGNED NULL,
    `type` ENUM('place', 'experience', 'event', 'custom') NOT NULL,
    `place_id` BIGINT UNSIGNED NULL,
    `experience_id` BIGINT UNSIGNED NULL,
    `event_id` BIGINT UNSIGNED NULL,
    `booking_id` BIGINT UNSIGNED NULL,
    `custom_title` VARCHAR(160) NULL,
    `start_time` VARCHAR(5) NULL,
    `duration_min` SMALLINT UNSIGNED NULL,
    `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `note_az` VARCHAR(500) NULL,
    `is_done` BOOLEAN NOT NULL DEFAULT false,
    `done_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trip_items_trip_id_trip_day_id_sort_order_idx`(`trip_id`, `trip_day_id`, `sort_order`),
    INDEX `trip_items_place_id_idx`(`place_id`),
    INDEX `trip_items_experience_id_idx`(`experience_id`),
    INDEX `trip_items_event_id_idx`(`event_id`),
    INDEX `trip_items_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_notes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_notes_trip_id_created_at_idx`(`trip_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offline_packages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('available', 'building', 'unavailable') NOT NULL DEFAULT 'available',
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `size_mb` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `place_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `manifest_url` VARCHAR(500) NULL,
    `built_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offline_packages_region_id_key`(`region_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offline_downloads` (
    `package_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `version` INTEGER UNSIGNED NOT NULL,
    `downloaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `offline_downloads_user_id_idx`(`user_id`),
    PRIMARY KEY (`package_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('experience', 'business_package', 'event') NOT NULL,
    `status` ENUM('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed', 'refunded') NOT NULL DEFAULT 'pending',
    `experience_id` BIGINT UNSIGNED NULL,
    `slot_id` BIGINT UNSIGNED NULL,
    `package_id` BIGINT UNSIGNED NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NULL,
    `adults` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `children` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `subtotal_azn` DECIMAL(10, 2) NOT NULL,
    `extras_azn` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `service_fee_azn` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_azn` DECIMAL(10, 2) NOT NULL,
    `idempotency_key` VARCHAR(64) NULL,
    `note` VARCHAR(500) NULL,
    `cancel_reason` VARCHAR(255) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_public_id_key`(`public_id`),
    UNIQUE INDEX `bookings_code_key`(`code`),
    UNIQUE INDEX `bookings_idempotency_key_key`(`idempotency_key`),
    INDEX `bookings_user_id_status_start_at_idx`(`user_id`, `status`, `start_at`),
    INDEX `bookings_experience_id_start_at_idx`(`experience_id`, `start_at`),
    INDEX `bookings_package_id_start_at_idx`(`package_id`, `start_at`),
    INDEX `bookings_status_start_at_idx`(`status`, `start_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name_az` VARCHAR(120) NOT NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `unit_azn` DECIMAL(10, 2) NOT NULL,
    `total_azn` DECIMAL(10, 2) NOT NULL,

    INDEX `booking_items_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `booking_id` BIGINT UNSIGNED NULL,
    `subscription_id` BIGINT UNSIGNED NULL,
    `provider` ENUM('mock', 'kapital', 'azericard', 'pasha', 'apple_iap', 'google_iap') NOT NULL DEFAULT 'mock',
    `status` ENUM('created', 'requires_action', 'succeeded', 'failed', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'created',
    `amount_azn` DECIMAL(10, 2) NOT NULL,
    `refunded_azn` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL DEFAULT 'AZN',
    `provider_intent_id` VARCHAR(190) NULL,
    `provider_payment_id` VARCHAR(190) NULL,
    `method_id` BIGINT UNSIGNED NULL,
    `failure_code` VARCHAR(60) NULL,
    `failure_message` VARCHAR(255) NULL,
    `raw_payload` JSON NULL,
    `paid_at` DATETIME(3) NULL,
    `refunded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_public_id_key`(`public_id`),
    INDEX `payments_booking_id_idx`(`booking_id`),
    INDEX `payments_subscription_id_idx`(`subscription_id`),
    INDEX `payments_status_created_at_idx`(`status`, `created_at`),
    INDEX `payments_provider_intent_id_idx`(`provider_intent_id`),
    INDEX `payments_method_id_idx`(`method_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `provider` ENUM('mock', 'kapital', 'azericard', 'pasha', 'apple_iap', 'google_iap') NOT NULL DEFAULT 'mock',
    `brand` VARCHAR(24) NULL,
    `last4` CHAR(4) NULL,
    `exp_month` TINYINT UNSIGNED NULL,
    `exp_year` SMALLINT UNSIGNED NULL,
    `holder_name` VARCHAR(120) NULL,
    `providerToken` VARCHAR(255) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `payment_methods_user_id_is_default_idx`(`user_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `gross_azn` DECIMAL(10, 2) NOT NULL,
    `rate` DECIMAL(4, 3) NOT NULL DEFAULT 0.20,
    `platform_azn` DECIMAL(10, 2) NOT NULL,
    `expert_azn` DECIMAL(10, 2) NOT NULL,
    `payout_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `commissions_booking_id_key`(`booking_id`),
    INDEX `commissions_payout_id_idx`(`payout_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payouts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('pending', 'processing', 'paid', 'failed') NOT NULL DEFAULT 'pending',
    `amount_azn` DECIMAL(10, 2) NOT NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `bank_name` VARCHAR(120) NULL,
    `account_last4` CHAR(4) NULL,
    `reference` VARCHAR(120) NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payouts_public_id_key`(`public_id`),
    INDEX `payouts_user_id_status_idx`(`user_id`, `status`),
    INDEX `payouts_period_start_period_end_idx`(`period_start`, `period_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `place_id` BIGINT UNSIGNED NULL,
    `route_id` BIGINT UNSIGNED NULL,
    `visibility` ENUM('public', 'followers', 'private') NOT NULL DEFAULT 'public',
    `body` TEXT NULL,
    `hashtags` VARCHAR(500) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `like_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `comment_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `share_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `save_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `posts_public_id_key`(`public_id`),
    INDEX `posts_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    INDEX `posts_created_at_idx`(`created_at` DESC),
    INDEX `posts_place_id_idx`(`place_id`),
    INDEX `posts_route_id_idx`(`route_id`),
    FULLTEXT INDEX `posts_body_hashtags_idx`(`body`, `hashtags`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_media` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `post_media_media_id_idx`(`media_id`),
    UNIQUE INDEX `post_media_post_id_sort_order_key`(`post_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_likes` (
    `post_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `post_likes_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`post_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `post_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `body` TEXT NOT NULL,
    `like_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `comments_public_id_key`(`public_id`),
    INDEX `comments_post_id_created_at_idx`(`post_id`, `created_at`),
    INDEX `comments_user_id_idx`(`user_id`),
    INDEX `comments_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_likes` (
    `comment_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comment_likes_user_id_idx`(`user_id`),
    PRIMARY KEY (`comment_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `place_id` BIGINT UNSIGNED NULL,
    `caption` VARCHAR(255) NULL,
    `view_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `stories_public_id_key`(`public_id`),
    INDEX `stories_user_id_expires_at_idx`(`user_id`, `expires_at`),
    INDEX `stories_expires_at_idx`(`expires_at`),
    INDEX `stories_media_id_idx`(`media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `story_views` (
    `story_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `story_views_user_id_idx`(`user_id`),
    PRIMARY KEY (`story_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `type` ENUM('direct', 'support') NOT NULL DEFAULT 'direct',
    `last_message_at` DATETIME(3) NULL,
    `last_message_preview` VARCHAR(190) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conversations_public_id_key`(`public_id`),
    INDEX `conversations_last_message_at_idx`(`last_message_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_participants` (
    `conversation_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `unread_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `last_read_at` DATETIME(3) NULL,
    `muted_until` DATETIME(3) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `left_at` DATETIME(3) NULL,

    INDEX `conversation_participants_user_id_unread_count_idx`(`user_id`, `unread_count`),
    PRIMARY KEY (`conversation_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `conversation_id` BIGINT UNSIGNED NOT NULL,
    `sender_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('text', 'image', 'experience_card', 'route_card', 'booking_card', 'system') NOT NULL DEFAULT 'text',
    `body` TEXT NULL,
    `media_id` BIGINT UNSIGNED NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `messages_public_id_key`(`public_id`),
    INDEX `messages_conversation_id_created_at_idx`(`conversation_id`, `created_at` DESC),
    INDEX `messages_sender_id_idx`(`sender_id`),
    INDEX `messages_media_id_idx`(`media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `reporter_id` BIGINT UNSIGNED NOT NULL,
    `target_type` ENUM('post', 'comment', 'review', 'user', 'place', 'experience', 'message') NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `reported_user_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(60) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `status` ENUM('open', 'reviewing', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
    `resolved_by_id` BIGINT UNSIGNED NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reports_public_id_key`(`public_id`),
    INDEX `reports_status_created_at_idx`(`status`, `created_at`),
    INDEX `reports_target_type_target_id_idx`(`target_type`, `target_id`),
    INDEX `reports_reporter_id_idx`(`reporter_id`),
    INDEX `reports_reported_user_id_idx`(`reported_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `target_type` ENUM('place', 'route', 'experience', 'business', 'event') NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `booking_id` BIGINT UNSIGNED NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `body` TEXT NULL,
    `tags` VARCHAR(255) NULL,
    `helpful_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `reviews_public_id_key`(`public_id`),
    INDEX `reviews_target_type_target_id_created_at_idx`(`target_type`, `target_id`, `created_at` DESC),
    INDEX `reviews_target_type_target_id_rating_idx`(`target_type`, `target_id`, `rating`),
    INDEX `reviews_booking_id_idx`(`booking_id`),
    UNIQUE INDEX `reviews_user_id_target_type_target_id_key`(`user_id`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_photos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `review_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_photos_review_id_sort_order_idx`(`review_id`, `sort_order`),
    INDEX `review_photos_media_id_idx`(`media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_helpful` (
    `review_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_helpful_user_id_idx`(`user_id`),
    PRIMARY KEY (`review_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_replies` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `review_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `review_replies_review_id_idx`(`review_id`),
    INDEX `review_replies_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saved_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `target_type` ENUM('place', 'route', 'experience', 'event', 'post', 'business') NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `saved_items_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    UNIQUE INDEX `saved_items_user_id_target_type_target_id_key`(`user_id`, `target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collections` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `cover_id` BIGINT UNSIGNED NULL,
    `is_private` BOOLEAN NOT NULL DEFAULT false,
    `item_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collections_public_id_key`(`public_id`),
    INDEX `collections_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_items` (
    `collection_id` BIGINT UNSIGNED NOT NULL,
    `saved_item_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `collection_items_saved_item_id_idx`(`saved_item_id`),
    PRIMARY KEY (`collection_id`, `saved_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `levels` (
    `level` SMALLINT UNSIGNED NOT NULL,
    `tier_code` VARCHAR(30) NOT NULL,
    `tier_name_az` VARCHAR(60) NOT NULL,
    `tier_name_en` VARCHAR(60) NOT NULL,
    `xp_required` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`level`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `badges` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(60) NOT NULL,
    `name_az` VARCHAR(80) NOT NULL,
    `name_en` VARCHAR(80) NOT NULL,
    `description_az` VARCHAR(255) NULL,
    `condition_type` ENUM('places_visited', 'posts_created', 'routes_created', 'experiences_done', 'level_reached', 'reviews_written', 'regions_visited', 'checkins') NOT NULL,
    `condition_value` INTEGER UNSIGNED NOT NULL,
    `icon` VARCHAR(60) NULL,
    `tier` VARCHAR(20) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `badges_slug_key`(`slug`),
    INDEX `badges_is_active_sort_order_idx`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_badges` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `badge_id` BIGINT UNSIGNED NOT NULL,
    `progress` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `earned_at` DATETIME(3) NULL,

    INDEX `user_badges_badge_id_earned_at_idx`(`badge_id`, `earned_at`),
    PRIMARY KEY (`user_id`, `badge_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `xp_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('place_checkin', 'experience_completed', 'review_written', 'media_shared', 'route_created', 'profile_completed', 'booking_completed', 'trip_completed', 'admin_adjustment') NOT NULL,
    `xp` INTEGER NOT NULL,
    `score_delta` INTEGER NOT NULL DEFAULT 0,
    `target_type` VARCHAR(40) NULL,
    `target_id` BIGINT UNSIGNED NULL,
    `level_after` SMALLINT UNSIGNED NOT NULL,
    `note` VARCHAR(190) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `xp_transactions_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    INDEX `xp_transactions_user_id_action_created_at_idx`(`user_id`, `action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkins` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `place_id` BIGINT UNSIGNED NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `trip_id` BIGINT UNSIGNED NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `xp_awarded` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_first` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `checkins_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    INDEX `checkins_place_id_idx`(`place_id`),
    INDEX `checkins_user_id_place_id_idx`(`user_id`, `place_id`),
    INDEX `checkins_region_id_idx`(`region_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leaderboard_snapshots` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `period` ENUM('weekly', 'monthly', 'all_time') NOT NULL,
    `scope` VARCHAR(60) NOT NULL,
    `periodKey` VARCHAR(20) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `rank` INTEGER UNSIGNED NOT NULL,
    `score` INTEGER UNSIGNED NOT NULL,
    `xp_gained` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leaderboard_snapshots_period_scope_periodKey_rank_idx`(`period`, `scope`, `periodKey`, `rank`),
    INDEX `leaderboard_snapshots_user_id_idx`(`user_id`),
    UNIQUE INDEX `leaderboard_snapshots_period_scope_periodKey_user_id_key`(`period`, `scope`, `periodKey`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NULL,
    `type` ENUM('social_follow', 'social_like', 'social_comment', 'booking_update', 'payment_update', 'xp_gained', 'level_up', 'badge_earned', 'event_reminder', 'trip_reminder', 'offer', 'system') NOT NULL,
    `title_az` VARCHAR(190) NOT NULL,
    `body_az` VARCHAR(500) NULL,
    `target_type` VARCHAR(40) NULL,
    `target_id` BIGINT UNSIGNED NULL,
    `deep_link` VARCHAR(255) NULL,
    `image_url` VARCHAR(500) NULL,
    `read_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notifications_public_id_key`(`public_id`),
    INDEX `notifications_user_id_read_at_created_at_idx`(`user_id`, `read_at`, `created_at` DESC),
    INDEX `notifications_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_preferences` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `social_push` BOOLEAN NOT NULL DEFAULT true,
    `social_email` BOOLEAN NOT NULL DEFAULT false,
    `booking_push` BOOLEAN NOT NULL DEFAULT true,
    `booking_email` BOOLEAN NOT NULL DEFAULT true,
    `gamification_push` BOOLEAN NOT NULL DEFAULT true,
    `offers_push` BOOLEAN NOT NULL DEFAULT true,
    `offers_email` BOOLEAN NOT NULL DEFAULT false,
    `reminders_push` BOOLEAN NOT NULL DEFAULT true,
    `quiet_hours_start` VARCHAR(5) NULL,
    `quiet_hours_end` VARCHAR(5) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expert_applications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('draft', 'submitted', 'reviewing', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
    `specialties` VARCHAR(255) NULL,
    `regions` VARCHAR(255) NULL,
    `languages` VARCHAR(60) NULL,
    `about_az` TEXT NULL,
    `id_document_id` BIGINT UNSIGNED NULL,
    `certificate_id` BIGINT UNSIGNED NULL,
    `terms_accepted_at` DATETIME(3) NULL,
    `submitted_at` DATETIME(3) NULL,
    `reviewed_by_id` BIGINT UNSIGNED NULL,
    `reviewed_at` DATETIME(3) NULL,
    `reject_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expert_applications_public_id_key`(`public_id`),
    UNIQUE INDEX `expert_applications_user_id_key`(`user_id`),
    INDEX `expert_applications_status_submitted_at_idx`(`status`, `submitted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` ENUM('gezgin_pro', 'expert_pro', 'business_pro') NOT NULL,
    `interval` VARCHAR(10) NOT NULL,
    `name_az` VARCHAR(120) NOT NULL,
    `price_azn` DECIMAL(10, 2) NOT NULL,
    `apple_product_id` VARCHAR(120) NULL,
    `google_product_id` VARCHAR(120) NULL,
    `features` JSON NULL,
    `trial_days` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `subscription_plans_code_interval_key`(`code`, `interval`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `plan_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
    `provider` ENUM('mock', 'kapital', 'azericard', 'pasha', 'apple_iap', 'google_iap') NOT NULL DEFAULT 'mock',
    `current_period_start` DATETIME(3) NOT NULL,
    `current_period_end` DATETIME(3) NOT NULL,
    `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT false,
    `cancelled_at` DATETIME(3) NULL,
    `trial_ends_at` DATETIME(3) NULL,
    `provider_subscription_id` VARCHAR(190) NULL,
    `latest_receipt` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_public_id_key`(`public_id`),
    INDEX `subscriptions_user_id_status_idx`(`user_id`, `status`),
    INDEX `subscriptions_status_current_period_end_idx`(`status`, `current_period_end`),
    INDEX `subscriptions_plan_id_idx`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `owner_id` BIGINT UNSIGNED NULL,
    `type` ENUM('image', 'video', 'audio', 'document') NOT NULL DEFAULT 'image',
    `status` ENUM('pending', 'ready', 'failed') NOT NULL DEFAULT 'pending',
    `storage_key` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(80) NOT NULL,
    `size_bytes` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `width` SMALLINT UNSIGNED NULL,
    `height` SMALLINT UNSIGNED NULL,
    `duration_s` SMALLINT UNSIGNED NULL,
    `blurhash` VARCHAR(60) NULL,
    `variants` JSON NULL,
    `alt_text` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `media_assets_public_id_key`(`public_id`),
    INDEX `media_assets_owner_id_created_at_idx`(`owner_id`, `created_at`),
    INDEX `media_assets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `key` VARCHAR(80) NOT NULL,
    `value` JSON NOT NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(80) NOT NULL,
    `target_type` VARCHAR(40) NULL,
    `target_id` BIGINT UNSIGNED NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `audit_logs_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `query` VARCHAR(190) NOT NULL,
    `entity_type` ENUM('place', 'route', 'experience', 'event', 'user', 'business') NULL,
    `result_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_history_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_avatar_id_fkey` FOREIGN KEY (`avatar_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_home_region_id_fkey` FOREIGN KEY (`home_region_id`) REFERENCES `regions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_interests` ADD CONSTRAINT `user_interests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_interests` ADD CONSTRAINT `user_interests_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_codes` ADD CONSTRAINT `otp_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follows` ADD CONSTRAINT `follows_follower_id_fkey` FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follows` ADD CONSTRAINT `follows_following_id_fkey` FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_blocker_id_fkey` FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_blocked_id_fkey` FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regions` ADD CONSTRAINT `regions_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `regions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regions` ADD CONSTRAINT `regions_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `region_translations` ADD CONSTRAINT `region_translations_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `places` ADD CONSTRAINT `places_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `places` ADD CONSTRAINT `places_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_translations` ADD CONSTRAINT `place_translations_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_photos` ADD CONSTRAINT `place_photos_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_photos` ADD CONSTRAINT `place_photos_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_photos` ADD CONSTRAINT `place_photos_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_categories` ADD CONSTRAINT `place_categories_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_categories` ADD CONSTRAINT `place_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_attendees` ADD CONSTRAINT `event_attendees_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_attendees` ADD CONSTRAINT `event_attendees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_logo_id_fkey` FOREIGN KEY (`logo_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_packages` ADD CONSTRAINT `business_packages_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_photos` ADD CONSTRAINT `business_photos_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_photos` ADD CONSTRAINT `business_photos_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_translations` ADD CONSTRAINT `route_translations_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_days` ADD CONSTRAINT `route_days_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_stops` ADD CONSTRAINT `route_stops_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_stops` ADD CONSTRAINT `route_stops_route_day_id_fkey` FOREIGN KEY (`route_day_id`) REFERENCES `route_days`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_stops` ADD CONSTRAINT `route_stops_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_profiles` ADD CONSTRAINT `expert_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiences` ADD CONSTRAINT `experiences_expert_id_fkey` FOREIGN KEY (`expert_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiences` ADD CONSTRAINT `experiences_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiences` ADD CONSTRAINT `experiences_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiences` ADD CONSTRAINT `experiences_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_photos` ADD CONSTRAINT `experience_photos_experience_id_fkey` FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_photos` ADD CONSTRAINT `experience_photos_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_slots` ADD CONSTRAINT `experience_slots_experience_id_fkey` FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_inclusions` ADD CONSTRAINT `experience_inclusions_experience_id_fkey` FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `trips_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `trips_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `trips_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_days` ADD CONSTRAINT `trip_days_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_items` ADD CONSTRAINT `trip_items_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_items` ADD CONSTRAINT `trip_items_trip_day_id_fkey` FOREIGN KEY (`trip_day_id`) REFERENCES `trip_days`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_items` ADD CONSTRAINT `trip_items_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_items` ADD CONSTRAINT `trip_items_experience_id_fkey` FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_items` ADD CONSTRAINT `trip_items_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_items` ADD CONSTRAINT `trip_items_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_notes` ADD CONSTRAINT `trip_notes_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_packages` ADD CONSTRAINT `offline_packages_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_downloads` ADD CONSTRAINT `offline_downloads_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `offline_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_downloads` ADD CONSTRAINT `offline_downloads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_experience_id_fkey` FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `experience_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `business_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_method_id_fkey` FOREIGN KEY (`method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_payout_id_fkey` FOREIGN KEY (`payout_id`) REFERENCES `payouts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_media` ADD CONSTRAINT `post_media_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_media` ADD CONSTRAINT `post_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_likes` ADD CONSTRAINT `post_likes_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_likes` ADD CONSTRAINT `post_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_likes` ADD CONSTRAINT `comment_likes_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_likes` ADD CONSTRAINT `comment_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stories` ADD CONSTRAINT `stories_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stories` ADD CONSTRAINT `stories_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story_views` ADD CONSTRAINT `story_views_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story_views` ADD CONSTRAINT `story_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_reported_user_id_fkey` FOREIGN KEY (`reported_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_photos` ADD CONSTRAINT `review_photos_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_photos` ADD CONSTRAINT `review_photos_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_helpful` ADD CONSTRAINT `review_helpful_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_helpful` ADD CONSTRAINT `review_helpful_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saved_items` ADD CONSTRAINT `saved_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collections` ADD CONSTRAINT `collections_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collections` ADD CONSTRAINT `collections_cover_id_fkey` FOREIGN KEY (`cover_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_items` ADD CONSTRAINT `collection_items_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_items` ADD CONSTRAINT `collection_items_saved_item_id_fkey` FOREIGN KEY (`saved_item_id`) REFERENCES `saved_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_badges` ADD CONSTRAINT `user_badges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_badges` ADD CONSTRAINT `user_badges_badge_id_fkey` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `xp_transactions` ADD CONSTRAINT `xp_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leaderboard_snapshots` ADD CONSTRAINT `leaderboard_snapshots_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_applications` ADD CONSTRAINT `expert_applications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_applications` ADD CONSTRAINT `expert_applications_id_document_id_fkey` FOREIGN KEY (`id_document_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expert_applications` ADD CONSTRAINT `expert_applications_certificate_id_fkey` FOREIGN KEY (`certificate_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_history` ADD CONSTRAINT `search_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
