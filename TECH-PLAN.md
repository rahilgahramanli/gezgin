# GEZGIN.app — Texnoloji Stack və Development Planı

> Bu sənəd [PLAN.md](PLAN.md) (məhsul planı) və `design/` (56 mobil ekran) əsasında hazırlanıb.
> Mərhələ: **planlama**. Kod yazılmayıb — bu, razılaşdırıldıqdan sonra icra ediləcək yol xəritəsidir.

---

## 0. Bir baxışda

| Göstərici | Dəyər |
|---|---|
| Mobil ekran | **56** (dizaynı hazır) |
| API modulu | **24** |
| Mobil endpoint | **~199** |
| Admin endpoint | **~25** |
| **Cəmi endpoint** | **~224** |
| WebSocket hadisəsi | ~10 |
| MySQL cədvəli | **74** |
| Sprint | **12** (Sprint 0 = 1 həftə, qalanı 2 həftə) |
| Müddət | **~23 həftə (≈5.5 ay)** — MVP 11-ci həftədə |
| Komanda | 1 tech lead + 1 backend + 2 React Native + 0.5 QA + 0.5 dizayner |

---

## 1. Texnoloji stack

### 1.1 Mobil — React Native

| Sahə | Seçim | Səbəb |
|---|---|---|
| Framework | **React Native 0.76+ / Expo SDK 52 (dev-client)** | Native modul (xəritə, kamera, push) üçün config plugin; EAS Build ilə CI/CD |
| Dil | TypeScript (strict) | Backend ilə paylaşılan tiplər |
| Naviqasiya | React Navigation 7 (Bottom Tabs + Native Stack) | Dizaynda 5 tab + modal/sheet axınları |
| Server state | **TanStack Query v5** | Keşləmə, infinite scroll (lent, siyahılar), optimistic update (bəyənmə, saxla) |
| Client state | Zustand | Auth, filtr, aktiv marşrut vəziyyəti |
| Formlar | react-hook-form + Zod | Backend DTO-ları ilə eyni Zod sxemləri |
| Xəritə | **Mapbox (@rnmapbox/maps)** | **Offline paketlər** (ekran 25) Google Maps-də mümkün deyil |
| Yerli DB | WatermelonDB (SQLite) | Offline marşrut, plan, məkan keşi |
| Yaddaş | MMKV | Token, ayarlar — AsyncStorage-dan ~10× sürətli |
| Şəkil | expo-image | Keş, blurhash placeholder |
| Media | expo-camera, expo-image-picker, expo-video | Post, story, rəy fotosu |
| Push | expo-notifications → FCM / APNs | Bildirişlər, deep link |
| i18n | i18next + expo-localization | AZ (əsas) / EN / RU |
| Animasiya | Reanimated 3 + Gesture Handler | Bottom sheet, story progress, check-in konfetti |
| Sheet | @gorhom/bottom-sheet | Ekran 43, 45, 48 |
| Analitika | PostHog | Funnel: kəşf → plan → bron |
| Crash | Sentry | |
| Test | Jest + React Native Testing Library, Maestro (E2E) | |

**Dizayn sistemi → koda köçürmə:** `design/gezgin.css`-dəki tokenlər (`--green-900`, `--brown-700`, radius, kölgə, tipoqrafiya) `packages/shared/theme.ts` faylına çevrilir; komponentlər (`.btn`, `.card`, `.chip`, `.pill`, `.row-card`, `.tabbar`…) RN komponent kitabxanası kimi Sprint 0-da yazılır.

### 1.2 Backend — Node.js

| Sahə | Seçim | Səbəb |
|---|---|---|
| Runtime | **Node.js 22 LTS** | |
| Framework | **NestJS 11** | `buta-api` ilə eyni — modul, DI, guard, interceptor hazır pattern |
| Dil | TypeScript (strict) | |
| ORM | **Prisma 6** (`provider = "mysql"`) | `buta-api`-də sınaqdan keçib; migration + type-safe client |
| DB | **MySQL 8.4** (utf8mb4_0900_ai_ci) | Azərbaycan hərfləri (ə, ğ, ş, ı, ö, ü, ç) düzgün sıralanır |
| Keş / queue | **Redis 7 + BullMQ** | XP hesablama, feed fan-out, push, e-mail, şəkil emalı |
| Realtime | **Socket.IO** (NestJS Gateway) | Çat, canlı bildiriş, aktiv marşrut |
| Auth | Passport + JWT (access 15 dəq / refresh 30 gün, rotating) | Argon2id şifrə hash |
| Validasiya | class-validator + class-transformer | |
| Fayl | S3-uyğun: dev **MinIO**, prod Cloudflare R2 / AWS S3 | Presigned upload — API-dən keçmir |
| Şəkil emalı | sharp (worker) | 3 ölçü + WebP + blurhash |
| Video | Mux və ya ffmpeg worker | Story / post videoları |
| Mail | Nodemailer + Resend/SES | OTP, rezervasiya təsdiqi |
| Sənəd | Swagger (OpenAPI 3.1) → `openapi-typescript` | Mobil tərəf üçün avtomatik tip |
| Log | pino + request-id | |
| Rate limit | @nestjs/throttler + Redis | |
| Test | Jest + Supertest + Testcontainers | |

### 1.3 Coğrafi sorğular (MySQL-də vacib qərar)

Prisma spatial tipləri native dəstəkləmir. Həll:

```sql
-- places cədvəli
lat  DECIMAL(10,7) NOT NULL,
lng  DECIMAL(10,7) NOT NULL,
geo  POINT SRID 4326 GENERATED ALWAYS AS (ST_SRID(POINT(lng, lat), 4326)) STORED NOT NULL,
SPATIAL INDEX idx_places_geo (geo)
```

- Sxemdə `Unsupported("point")`, sorğu `prisma.$queryRaw` ilə:
  `ST_Distance_Sphere(geo, ST_SRID(POINT(?,?),4326)) < ?`
- Xəritə üçün bbox sorğusu: `MBRContains(ST_GeomFromText(?), geo)` + server tərəfi klasterləmə.
- Bu qərar Sprint 2-də `places` migration-ı ilə birlikdə icra olunur.

### 1.4 Admin panel

**Next.js 15 (App Router) + shadcn/ui + TanStack Table** — eyni API-nin `/admin/*` endpointlərini istifadə edir. Sprint 10.

### 1.5 Xarici xidmətlər

| Xidmət | Təyinat | Qərar tələb edir |
|---|---|---|
| Mapbox | Xəritə + offline paket | ✅ tövsiyə |
| Ödəniş PSP | Kart ödənişi, 3-D Secure | ⚠️ **Kapital / AzeriCard / PashaPay** — seçim lazımdır |
| Apple / Google IAP | Gezgin PRO abunəliyi | Mağaza qaydası: rəqəmsal abunəlik IAP-dan keçməlidir |
| FCM + APNs | Push | |
| Resend / SES | E-mail | |
| Cloudflare R2 + CDN | Media | |
| Sentry, PostHog | Monitorinq, analitika | |

---

## 2. Repo strukturu (monorepo — pnpm + Turborepo)

```
gezgin/
├── apps/
│   ├── api/                  # NestJS — mobil + admin API
│   │   ├── src/modules/      # 24 modul (aşağıdakı cədvəl)
│   │   ├── src/common/       # guard, interceptor, filter, decorator
│   │   ├── src/jobs/         # BullMQ worker-lər
│   │   ├── prisma/           # schema.prisma, migrations, seed.ts
│   │   └── test/
│   ├── mobile/               # React Native (Expo)
│   │   ├── src/screens/      # 56 ekran — design/screens ilə 1:1
│   │   ├── src/components/   # dizayn sistemi komponentləri
│   │   ├── src/api/          # generated client (openapi-typescript)
│   │   └── src/store/, hooks/, i18n/
│   └── admin/                # Next.js admin panel
├── packages/
│   ├── shared/               # tiplər, Zod sxemləri, XP/level qaydaları, sabitlər
│   └── theme/                # dizayn tokenləri (CSS ↔ RN)
├── docker/                   # Dockerfile-lar, nginx, init.sql
├── docker-compose.yml        # dev mühiti
├── design/                   # 56 HTML ekran (hazır)
├── PLAN.md                   # məhsul planı
└── TECH-PLAN.md              # bu sənəd
```

**Niyə monorepo:** OpenAPI-dən yaranan tiplər və XP/level qaydaları həm backend, həm mobil, həm admin tərəfindən eyni mənbədən istifadə olunur — uyğunsuzluq riski aradan qalxır.

---

## 3. Arxitektura

```
┌─────────────┐   ┌─────────────┐   ┌──────────────┐
│ React Native│   │ Admin (Next)│   │ Business web │
│  iOS/Android│   │             │   │  (Faza 4)    │
└──────┬──────┘   └──────┬──────┘   └──────┬───────┘
       │ HTTPS/JSON + WS │                 │
       └────────┬────────┴─────────────────┘
                ▼
        ┌───────────────┐
        │ nginx (TLS)   │  rate limit, gzip, static
        └───────┬───────┘
                ▼
    ┌───────────────────────┐        ┌──────────────┐
    │  NestJS API (2+ pod)  │◄──────►│  Redis       │ keş, session, queue
    │  REST /api/v1 + WS    │        └──────┬───────┘
    └───────┬───────────────┘               │
            │                        ┌──────▼───────┐
            ▼                        │ BullMQ worker│ XP, feed, push,
    ┌───────────────┐                │              │ mail, şəkil, video
    │   MySQL 8.4   │◄───────────────┴──────────────┘
    │  (+ replica)  │
    └───────────────┘
            │
            ▼
    ┌───────────────┐   ┌──────────┐   ┌───────────┐
    │ S3 / R2 + CDN │   │ Mapbox   │   │ PSP, FCM  │
    └───────────────┘   └──────────┘   └───────────┘
```

---

## 4. Data modeli — 74 MySQL cədvəli

**Ümumi qaydalar:** `BIGINT UNSIGNED AUTO_INCREMENT` daxili ID + xaricə açıq `public_id CHAR(26)` (ULID); bütün tarixlər UTC `DATETIME(3)`; soft delete (`deleted_at`); `created_at` / `updated_at`; çoxdilli sahələr ayrıca `*_translations` cədvəlində (AZ/EN/RU).

| Qrup | Cədvəllər |
|---|---|
| **İstifadəçi (8)** | `users`, `user_settings`, `user_interests`, `otp_codes`, `refresh_tokens`, `devices`, `follows`, `blocks` |
| **Kontent (12)** | `regions`, `region_translations`, `categories`, `places`, `place_photos`, `place_translations`, `place_categories`, `events`, `event_attendees`, `businesses`, `business_packages`, `business_photos` |
| **Marşrut & təcrübə (9)** | `routes`, `route_days`, `route_stops`, `route_translations`, `experiences`, `experience_photos`, `experience_slots`, `experience_inclusions`, `expert_profiles` |
| **Planlama (5)** | `trips`, `trip_days`, `trip_items`, `trip_notes`, `offline_packages` |
| **Rezervasiya (6)** | `bookings`, `booking_items`, `payments`, `payouts`, `commissions`, `payment_methods` |
| **Sosial (11)** | `posts`, `post_media`, `post_likes`, `comments`, `comment_likes`, `stories`, `story_views`, `conversations`, `conversation_participants`, `messages`, `reports` |
| **Rəy (4)** | `reviews`, `review_photos`, `review_helpful`, `review_replies` |
| **Saxlanılan (3)** | `saved_items`, `collections`, `collection_items` |
| **Gamification (6)** | `levels`, `badges`, `user_badges`, `xp_transactions`, `checkins`, `leaderboard_snapshots` |
| **Sistem (8)** | `notifications`, `notification_preferences`, `expert_applications`, `subscriptions`, `subscription_plans`, `media_assets`, `app_settings`, `audit_logs` |
| **Axtarış (1)** | `search_history` |
| **Offline (1)** | `offline_downloads` |

**Vacib indekslər:** `places(geo)` SPATIAL · `places(region_id, category_id, rating)` · `posts(user_id, created_at)` · `follows(follower_id, following_id)` UNIQUE · `xp_transactions(user_id, created_at)` · `bookings(user_id, status, start_at)` · FULLTEXT `places(name, description)` (axtarış — sonra Meilisearch-ə köçmək olar).

---

## 5. API — konvensiyalar

- **Baza:** `https://api.gezgin.app/api/v1`
- **Autentifikasiya:** `Authorization: Bearer <access>` · refresh rotasiya ilə (`/auth/refresh`)
- **Səhifələmə:** cursor-based — `?cursor=<ulid>&limit=20` → `{ data: [], nextCursor }`
- **Xəta formatı:** `{ statusCode, code: "BOOKING_SLOT_TAKEN", message, details }` — mobil tərəf `code` üzrə tərcümə göstərir
- **Idempotency:** `Idempotency-Key` başlığı — rezervasiya və ödənişdə məcburi
- **Dil:** `Accept-Language: az|en|ru`
- **Rate limit:** anonim 60 sorğu/dəq, auth 300/dəq, OTP 5/saat
- **Versiya:** URL-də (`/v1`); breaking change → `/v2`
- **Sənəd:** `/docs` (Swagger UI), `/docs-json` → mobil tiplər avtomatik yaranır

### Endpoint inventarı — 24 modul, ~201 mobil endpoint

| # | Modul | Nümunə endpointlər | Say | Sprint |
|---|---|---|---|---|
| 1 | `system` | `GET /health`, `/config`, `/categories`, `/app-version`, `/legal/:slug`, `POST /feedback` | 6 | 0 |
| 2 | `auth` | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/otp/send`, `/otp/verify`, `/password/forgot`, `/password/reset`, `/password/change`, `/social/google`, `/social/apple`, `/guest` | 12 | 1 |
| 3 | `me` | `GET|PATCH /me`, `/me/avatar`, `/me/cover`, `/me/interests`, `/me/settings`, `/me/stats`, `/me/regions`, `/me/blocked`, `DELETE /me` … | 14 | 1 |
| 4 | `media` | `POST /media/presign`, `/media/:id/complete`, `DELETE /media/:id`, `GET /media/:id` | 4 | 1 |
| 5 | `regions` | `GET /regions`, `/regions/:slug`, `/regions/map` | 3 | 2 |
| 6 | `places` | `GET /places` (filtr/geo), `/places/map`, `/places/filters`, `/places/:slug`, `/photos`, `/nearby`, `POST /photos`, `/report` | 8 | 2 |
| 7 | `search` | `GET /search`, `/suggest`, `/popular`, `/recent`, `DELETE /recent` | 5 | 2 |
| 8 | `reviews` | `GET /reviews`, `/summary`, `POST|DELETE /:id/helpful` (S2) · yazma, redaktə, cavab (S7) | 4 + 3 | 2 / 7 |
| 9 | `routes` | `GET /routes`, `/recommended`, `/mine`, `/:slug`, `POST`, `PATCH`, `DELETE`, stop CRUD + reorder, `/copy` | 12 | 3 |
| 10 | `experiences` | `GET /experiences`, `/mine`, `/:slug`, `/availability`, `POST`, `PATCH`, `DELETE`, `/publish`, `/slots` | 9 | 3 |
| 10a | `experts` | `GET /experts/:username` — Local Expert profili | 1 | 3 |
| 11 | `trips` | `GET|POST /trips`, `/:id`, gün CRUD, element CRUD + reorder, `/start`, `/complete`, `/notes` | 14 | 4 |
| 12 | `saved` | `GET|POST /saved`, `DELETE /saved/:type/:target` | 3 | 4 |
| 12a | `collections` | `GET|POST /collections`, `PATCH|DELETE /:id` | 4 | 4 |
| 13 | `gamification` | `GET /me/score`, `/me/xp`, `/me/badges`, `/me/checkins`, `/levels`, `/badges`, `/leaderboard`, `/xp-rules`, `POST /checkins` | 9 | 5 |
| 14 | `offline` | `GET /offline/packages`, `/:region/manifest`, `POST|DELETE /:region/download` | 4 | 5 |
| 15 | `bookings` | `POST /quote`, `POST /bookings`, `GET /bookings`, `/:id`, `/pay`, `/cancel`, `/ticket` | 7 | 6 |
| 16 | `payments` | `GET|POST /methods`, `DELETE /methods/:id`, `POST /webhook`, `/:id/refund` | 4 | 6 |
| 17 | `businesses` | `GET /businesses`, `/:slug`, `/packages`, `/photos`, `POST /contact` | 5 | 6 |
| 18 | `posts` | `GET /feed`, post CRUD, bəyənmə, şərh CRUD, saxla, paylaş, şikayət | 16 | 7 |
| 19 | `stories` | `GET /stories`, `POST /stories`, `/stories/:userId`, `POST /:id/view`, `DELETE /:id` | 5 | 7 |
| 20 | `users` | `GET /users/:username`, `/posts`, `/routes`, `/badges`, `/followers`, `/following`, `POST|DELETE /follow`, `/suggested`, `/report` | 10 | 7 |
| 21 | `chat` | `GET /conversations`, `POST`, `/:id`, `/:id/messages` (GET/POST), `/read`, `DELETE` | 7 | 7 |
| 22 | `expert` | `POST /expert/apply`, `GET /expert/application`, `/dashboard`, `/earnings`, `/bookings`, `/confirm`, `/decline`, `/payouts` … | 10 | 8 |
| 23 | `subscriptions` | `GET /subscriptions/plans`, `GET /me/subscription`, `POST /subscribe`, `/cancel`, `/restore` (IAP verify) | 5 | 8 |
| 24 | `events` | `GET /events`, `/:id`, `/calendar`, `/:id/attendees`, `POST|DELETE /:id/going` | 6 | 9 |
| 25 | `notifications` | `GET /notifications`, `/read-all`, `/:id/read`, tərcihlər, cihaz qeydiyyatı | 7 | 9 |
| | **CƏMİ (mobil)** | | **199** | |
| 26 | `admin/*` | Moderasiya növbəsi, kontent CRUD (region/məkan/marşrut/təcrübə/tədbir), istifadəçi idarəsi, expert müraciətləri, biznes listinqi, şikayətlər, broadcast, statistika | ~25 | 10 |
| | **ÜMUMİ** | | **~224** | |

### WebSocket hadisələri (~10)
`message.new` · `message.read` · `typing` · `conversation.updated` · `notification.new` · `booking.status_changed` · `xp.gained` · `level.up` · `badge.earned` · `trip.stop_reached`

---

## 6. Təhlükəsizlik və uyğunluq

- Argon2id şifrə hash · refresh token DB-də hash edilmiş, rotasiya + reuse detection
- OTP: 6 rəqəm, 10 dəq TTL, 5 cəhd limiti, brute-force üçün Redis sayğacı
- RBAC guard: `gezgin` / `local_expert` / `business` / `admin`
- Bütün input DTO validasiyası; SQL injection üçün yalnız parametrli `$queryRaw`
- Media: presigned PUT, MIME + ölçü yoxlaması, EXIF təmizləmə (yerləşmə sızmasın)
- Şəxsi data: hesab silmə (GDPR-uyğun), data ixracı, bloklama və şikayət mexanizmi
- Ödəniş: PAN saxlanılmır — yalnız PSP token; PCI DSS SAQ-A
- Expert ödənişləri: KYC + vergi sənədi (hüquqi tələb — Sprint 8-də dəqiqləşdirilməli)

## 6.1 Ödəniş abstraksiyası (PSP və IAP təxirə salındığı üçün)

PSP seçimi və mağaza abunəliyi (IAP) qərarı sonraya saxlanılıb. Bunun Sprint 6 və 8-i **bloklamaması** üçün ödəniş qatı əvvəldən interfeys arxasında yazılır:

```ts
interface PaymentProvider {
  createIntent(o: {amount: number; currency: 'AZN'; bookingId: string}): Promise<Intent>
  confirm(intentId: string, payload?: unknown): Promise<PaymentResult>
  refund(paymentId: string, amount?: number): Promise<RefundResult>
  handleWebhook(raw: Buffer, sig: string): Promise<WebhookEvent>
}
```

| Provayder | Vəziyyət | Nə edir |
|---|---|---|
| `MockPaymentProvider` | ✅ **yazıldı** | Test kartları: `4111…1111` uğur · `…0002` rədd · `…3220` 3-D Secure · `…0069` müddəti bitmiş |
| `KapitalProvider` / digər | sonra | Yalnız bu sinif yazılır — qalan kod dəyişmir |
| `MockIapProvider` | Sprint 8 | PRO abunəliyi qəbz yoxlamasını simulyasiya edəcək |
| `AppleIapProvider` / `GoogleIapProvider` | sonra | Qəbz validasiyası real API-yə bağlanır |

**Nəticə:** Sprint 6 və 8 tam funksional bitir — rezervasiya, bilet, ləğv, komissiya hesabı, abunəlik vəziyyəti hamısı işləyir; yalnız pul hərəkəti mock-dur. Real PSP qoşulanda gözlənilən iş: **3–5 gün** (bir sinif + webhook imza yoxlaması + sertifikasiya testləri). Şərt: bu iş **Sprint 11-ə (buraxılışdan əvvəl) qədər** tamamlanmalıdır.

## 7. Fon işləri (BullMQ)

| Queue | İş |
|---|---|
| `xp` | Check-in / rəy / post → XP hesabla, level yoxla, badge ver, bildiriş at |
| `feed` | Post yaradılanda izləyicilərin lentinə fan-out (push model, 5K izləyiciyə qədər) |
| `media` | Şəkil resize (3 ölçü + WebP + blurhash), video transcode |
| `push` | FCM/APNs toplu göndərmə, deep link |
| `mail` | OTP, rezervasiya təsdiqi, həftəlik icmal |
| `payout` | Local Expert ödənişləri (həftəlik), komissiya hesabatı |
| `cron` | Leaderboard snapshot (gecə), tədbir xatırlatması, abunəlik yenilənməsi, keş isindirmə |

## 8. Docker və mühitlər

**Dev — `docker compose up`:**
`mysql:8.4` · `redis:7` · `minio` + `minio-init` · `mailhog` · `phpmyadmin` · `api` (watch) · `worker`

> **Port qeydi:** development maşınında 3306, 6379, 8080 və 3000 başqa layihələr tərəfindən tutulub, ona görə GEZGIN **3310** (MySQL), **6381** (Redis), **8083** (phpMyAdmin), **3100** (API), **9010/9011** (MinIO) portlarından istifadə edir. Hamısı `.env`-dən dəyişdirilə bilər.

**Prod:** multi-stage Dockerfile (build → `node:22-alpine` runtime, non-root) · `nginx` (TLS, Let's Encrypt) · API 2+ replika · ayrıca worker konteyneri · MySQL managed servis + gündəlik backup + PITR · healthcheck + rolling deploy.

**Mühitlər:** `local` → `staging` (hər `main` push) → `production` (tag ilə əl təsdiqi).

**CI/CD (GitHub Actions):** lint + typecheck + unit + e2e (Testcontainers) → Docker image → GHCR → staging deploy → `prisma migrate deploy`. Mobil: EAS Build → TestFlight / Play Internal.

---

## 9. Sprint planı

> Sprint 0 = 1 həftə, qalan sprintlər 2 həftə. Cəmi **23 həftə**.
> Hər sprintin sonunda: demo + staging deploy + retro.

| # | Sprint | Həftə | Backend | Mobil ekranlar | Nəticə (DoD) |
|---|---|---|---|---|---|
| **0** ✅ | Fundament — **tamamlandı** | 1 | Monorepo, NestJS skeleti, Prisma+MySQL, docker-compose, CI, Swagger, `system` (6), **CSV → DB seed importeri** | Expo layihəsi, naviqasiya skeleti, **dizayn sistemi komponentləri** (Button, Card, Chip, Pill, Input, TabBar, Avatar…) | `docker compose up` işləyir; RN app boş tablarla açılır; Storybook-da komponentlər |
| **1** ✅ | Auth & Profil — **tamamlandı** | 2–3 | `auth` (12), `me` (14), `media` (4) — **30** | 01, 02, 03, 04, 37, 38, 39, 34, 54 | Qeydiyyat → OTP → onboarding → profil redaktə; token rotasiyası + təkrar istifadə aşkarlaması; presigned media yükləmə; qonaq rejimi |
| **2** | Kəşf: məkan & xəritə | 4–5 | `regions` (4), `places` (9), `search` (4), `reviews` oxu (4) — **21** | 10, 11, 12, 13, 45, 46, 47, 32 | Mapbox-da pinlər, filtr paneli, məkan detalı, rəylər, region tərəqqisi |
| **3** | Marşrut & Təcrübə | 6–7 | `routes` (12), `experiences` (10) — **22** | 14, 15, 16, 17, 21 | Marşrut detalı xəritədə; təcrübə detalı 80/20 bölgü ilə; expert profili |
| **4** | Planım & Marşrut qurucu | 8–9 | `trips` (14), `saved` (7) — **21** | 23, 24, 48, 50, 33 | Məkan/təcrübə → plana əlavə; marşrut qur, sırala, günlərə böl; Want to go |
| **5** ✅ | Yaşa: check-in & gamification — **tamamlandı** | 10–11 | `gamification` (9), `offline` (4) — **13** | 51, 52, 28, 29, 30, 31, 25 | 🎯 **MVP hazırdır.** Check-in məsafə yoxlaması ilə, XP/level/badge eyni cavabda, gündəlik limitlər, liderlər cədvəli, offline manifest |
| **6** ✅ | Rezervasiya & ödəniş — **tamamlandı** | 12–13 | `bookings` (7), `payments` (4), `businesses` (5) — **16** | 18, 19, 22, 49, 53 | Qiymət hesabı (uşaq endirimi, əlavələr), idempotent sifariş, 3-D Secure, rədd/müddəti bitmiş kart, bilet + QR, ləğv siyasəti və geri qaytarma, 80/20 komissiya |
| **7** | Sosial lent | 14–15 | `posts` (16), `stories` (5), `users` (10), `chat` (7), `reviews` yazı (3) — **41** | 05, 06, 07, 08, 09, 26, 27, 40, 41, 42, 43 | Lent (For you/Following/Nearby), post/story yarat, şərh, izləmə, canlı çat |
| **8** | Ekosistem: Expert & PRO | 16–17 | `expert` (10), `subscriptions` (5) — **15** | 36, 55, 56, 35 | Expert müraciəti → təsdiq → təcrübə yarat → rezervasiya qəbulu → qazanc/ödəniş; PRO abunəlik (mock IAP) |
| **9** | Tədbirlər, push, offline | 18–19 | `events` (6), `notifications` (7) — **13** | 20, 44, 07, 25 | Push bildiriş + deep link; offline xəritə paketi və offline rejim |
| **10** | Admin panel & moderasiya | 20–21 | `admin/*` (~25) + Next.js panel | — | Kontent CRUD, moderasiya növbəsi, expert təsdiqi, statistika |
| **11** | Hardening & buraxılış | 22–23 | Performans, təhlükəsizlik auditi, i18n AZ/EN/RU, yük testi | Bütün ekranlar — polish, boş/xəta halları | 🚀 **App Store + Google Play** |

### Sprint 5 (MVP) nə edə biləcək
Qeydiyyat · maraq seçimi · xəritədə məkan kəşfi · filtr/axtarış · məkan və marşrut detalı · təcrübə baxışı · səyahət planı qurmaq · marşrut yaratmaq · yola çıxmaq və check-in etmək · XP/level/badge qazanmaq · profil və liderlər cədvəli · offline xəritə.
**Yoxdur:** ödəniş, sosial lent, çat, push, PRO.

---

## 10. Komanda və effort

| Rol | Sayı | Yüklənmə |
|---|---|---|
| Tech lead / backend | 1 | tam |
| Backend developer | 1 | tam |
| React Native developer | 2 | tam |
| QA | 1 | 50% (Sprint 2-dən) |
| Dizayner | 1 | 50% (hazır dizayn üzərində düzəlişlər) |
| PM / Product owner | 1 | 30% |

**Təxmini effort:** ~1 400 adam-saat backend + ~1 600 adam-saat mobil + ~250 QA.
**Minimal komanda ilə (1 backend + 1 mobil):** müddət ~2× artır → ~10 ay.

---

## 11. Risklər və açıq suallar

| Risk / sual | Vəziyyət | Təsir | Nə etməli |
|---|---|---|---|
| **PSP seçimi** (Kapital / AzeriCard / PashaPay) | ⏸ **təxirə salındı** | Sprint 6 bloklanmır — `MockPaymentProvider` ilə gedirik | Real inteqrasiya Sprint 11-ə qədər; qoşulma işi 3–5 gün |
| **PRO abunəliyi və mağaza IAP-ı** | ⏸ **təxirə salındı** | Sprint 8 bloklanmır — `MockIapProvider` ilə gedirik | Qiymət modeli və Apple/Google 15–30% payı buraxılışdan əvvəl həll edilməli |
| **Kontent (soyuq start)** | ✅ **həll olundu** | Komanda mock data verir | Format `seed/` qovluğunda hazırdır — CSV şablonları doldurulur |
| **Level sistemi ziddiyyəti** | ⚠️ **qərar lazımdır** | Gamification məntiqi (Sprint 5) | Prezentasiya 5 level göstərir, ekranlar Level 12/14/20 — `seed/config-levels.csv`-də 20 level + 5 tier təklifi verilib |
| Local Expert ödənişləri — KYC, vergi | açıq | Hüquqi | PSP qərarı ilə birlikdə həll olunur |
| Mapbox MAU qiyməti | açıq | Xərc | Sprint 2-də limit və qiymət modeli təsdiqi |
| Video hosting xərci | açıq | Xərc | MVP-də yalnız foto; video Sprint 7-də limitlə |
| İstifadəçi kontentinin moderasiyası | açıq | Brend / hüquqi | Şikayət axını Sprint 7, moderasiya paneli Sprint 10 |
| `buta-api`-dən təkrar istifadə | ✅ imkan | ≈1 sprint qənaət | Auth, upload, mail, Docker skeleti köçürülür |

---

## 12. Növbəti addım

~~Level sistemi qərarı~~ ✅ təsdiqləndi — `packages/shared/src/gamification.ts`
~~Sprint 0 — Fundament~~ ✅ tamamlandı
~~Sprint 1 — Auth & Profil~~ ✅ tamamlandı — 30 endpoint
~~Sprint 2 — Kəşf~~ ✅ tamamlandı — 20 endpoint
~~Sprint 3 — Marşrut & Təcrübə~~ ✅ tamamlandı — 22 endpoint
~~Sprint 4 — Planım & Saxlanılanlar~~ ✅ tamamlandı — 21 endpoint
~~Sprint 5 — Yaşa: check-in & gamification~~ ✅ **MVP** — 13 endpoint
~~Sprint 6 — Rezervasiya & ödəniş~~ ✅ tamamlandı — 16 endpoint, 173 test yaşıl

1. **Mock datanı doldurun** — `seed/` CSV şablonları. Hazırda 7 region, 11 məkan, 5 marşrut, 10 istifadəçi, 8 təcrübə yüklənib; hədəf: 50 region, 200 məkan.
2. **MVP-ni sınaqdan keçirin** — 112 endpoint canlıdır, tam dövrə işləyir: qeydiyyat → kəşf → plan → yola çıx → check-in → XP/level/badge.
3. **Sprint 7 — Sosial lent** (41 endpoint, ekranlar 05–09, 26, 27, 40–43) — layihənin ən böyük sprinti.

> PSP və IAP qərarları təxirə salınıb — mock provayderlərlə işləyirik, buraxılışdan əvvəl (Sprint 11) real inteqrasiya edilməlidir.
