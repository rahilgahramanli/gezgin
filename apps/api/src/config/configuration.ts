import { z } from 'zod';

/** Bütün mühit dəyişənləri burada yoxlanır — səhv konfiqurasiya ilə API qalxmır. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ROLE: z.enum(['api', 'worker']).default('api'),

  API_PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  API_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL tələb olunur'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET ən azı 16 simvol olmalıdır'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET ən azı 16 simvol olmalıdır'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('gezgin'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_PUBLIC_URL: z.string().default('http://localhost:9000/gezgin'),

  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('GEZGIN <no-reply@gezgin.app>'),

  PAYMENT_PROVIDER: z.enum(['mock', 'kapital', 'azericard', 'pasha']).default('mock'),
  IAP_PROVIDER: z.enum(['mock', 'store']).default('mock'),

  /** Ödənilməmiş rezervasiya neçə dəqiqədən sonra ləğv olunur və yeri boşaldır. */
  BOOKING_PAYMENT_TTL_MIN: z.coerce.number().int().positive().default(30),

  /** Check-in üçün məkana maksimum məsafə (metr). Dev-də böyük saxlanılır. */
  CHECKIN_RADIUS_M: z.coerce.number().int().positive().default(1000),

  SOCIAL_MODE: z.enum(['mock', 'live']).default('mock'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),

  MAPBOX_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Mühit dəyişənləri yanlışdır:\n${issues}`);
  }
  return parsed.data;
}

export default () => validateEnv(process.env);
