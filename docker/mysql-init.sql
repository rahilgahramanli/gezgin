-- GEZGIN — MySQL ilkin quraşdırma
-- utf8mb4_0900_ai_ci: Azərbaycan hərfləri (ə, ğ, ş, ı, ö, ü, ç) düzgün sıralanır və axtarılır.
ALTER DATABASE gezgin CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Test bazası (Jest / Testcontainers üçün)
CREATE DATABASE IF NOT EXISTS gezgin_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON gezgin_test.* TO 'gezgin'@'%';

-- Prisma shadow database (migrate dev üçün lazımdır)
CREATE DATABASE IF NOT EXISTS gezgin_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON gezgin_shadow.* TO 'gezgin'@'%';

FLUSH PRIVILEGES;
