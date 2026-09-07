import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 6.19+ prisma.config.ts ilə .env-i avtomatik yükləmir — özümüz yükləyirik.
// Monorepo kökündəki .env tək mənbədir; apps/api/.env ona symlink-dir.
loadEnv({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { seed: 'ts-node -T prisma/seed.ts' },
});
