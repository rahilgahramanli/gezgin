# GEZGIN.app

> **Gəz, yaşa, paylaş!** — Regional turizmin rəqəmsal infrastrukturu.
> İlham al → Kəşf et → Planla → Yaşa → Paylaş: hamısı bir platformada.

| Sənəd | Nədir |
|---|---|
| [PLAN.md](PLAN.md) | Məhsul planı — konsepsiya, rollar, 56 ekranın inventarı |
| [TECH-PLAN.md](TECH-PLAN.md) | Texniki plan — stack, API inventarı, data modeli, 12 sprint |
| [design/index.html](design/index.html) | 56 mobil ekranın HTML dizaynı (brauzerdə açın) |
| [seed/README.md](seed/README.md) | Mock kontentin CSV şablonları və doldurma qaydaları |

---

## Sürətli başlanğıc

```bash
cp .env.example .env          # portlar artıq boş olanlara qurulub
pnpm install
docker compose up -d mysql redis

pnpm --filter @gezgin/shared build
pnpm --filter @gezgin/api exec prisma migrate deploy
pnpm db:seed

pnpm --filter @gezgin/api start:dev
```

Açılır:

| Ünvan | Nədir |
|---|---|
| http://localhost:3100/api/v1/health | Servis vəziyyəti |
| http://localhost:3100/docs | Swagger UI |
| http://localhost:3100/docs-json | OpenAPI 3.1 (mobil tiplər buradan yaranır) |
| http://localhost:8083 | phpMyAdmin |
| http://localhost:8025 | Mailhog (dev e-mail) |
| http://localhost:9011 | MinIO konsolu |

> **Portlar:** bu maşında 3306, 6379, 8080 və 3000 başqa layihələr tərəfindən tutulduğu üçün GEZGIN 3310 (MySQL), 6381 (Redis), 8083 (phpMyAdmin), 3100 (API), 9010/9011 (MinIO) portlarından istifadə edir. Hamısı `.env`-dən dəyişdirilə bilər.

---

## Quruluş

```
gezgin/
├── apps/
│   ├── api/            NestJS 11 + Prisma 6 + MySQL 8.4
│   │   ├── prisma/     schema.prisma (74 model) · migrations · seed.ts
│   │   └── src/
│   │       ├── common/     PrismaService, xəta filtri, pagination, ULID
│   │       ├── config/     Zod ilə env validasiyası
│   │       ├── common/search/  Azərbaycan dili normalizasiyası + coğrafi SQL
│   │       └── modules/    system · auth · me · media · regions · places · search
│   │                        reviews · routes · experiences · trips · saved
│   │                        gamification · offline · bookings · payments
│   │                        businesses
│   ├── mobile/         React Native (Expo) — Sprint 0-ın ikinci hissəsi
│   └── admin/          Next.js admin panel — Sprint 10
├── packages/shared/    Dizayn tokenləri · level/XP qaydaları · xəta kodları
├── design/             56 HTML ekran + dizayn sistemi
├── seed/               Mock kontent (CSV)
└── docker/             Dockerfile · MySQL init
```

---

## Əsas komandalar

| Komanda | Nə edir |
|---|---|
| `pnpm docker:up` / `docker:down` | Dev servisləri |
| `pnpm db:migrate` | Yeni migration yaradır və tətbiq edir |
| `pnpm db:seed` | `seed/*.csv` fayllarını bazaya yükləyir (idempotent) |
| `pnpm db:reset` | Bazanı sıfırlayır və yenidən seed edir |
| `pnpm --filter @gezgin/api start:dev` | API (watch rejimi) |
| `pnpm --filter @gezgin/api test` | Testlər |
| `pnpm build` / `lint` / `typecheck` | Bütün paketlər (turbo) |

---

## Bilinməli detallar

**Coğrafi sorğular.** Prisma MySQL spatial tiplərini dəstəkləmir. `places`, `experiences`, `events`, `businesses`, `checkins`, `posts` cədvəllərində `geo POINT SRID 4326` sütunu əl migration-ı ilə əlavə olunub (`*_geo_spatial`) və `schema.prisma`-da yer almır. Yaxınlıq sorğuları `$queryRaw` ilə:

```sql
SELECT id, ST_Distance_Sphere(geo, ST_SRID(POINT(?, ?), 4326)) AS dist
FROM places
WHERE MBRContains(ST_GeomFromText(?, 4326), geo)
ORDER BY dist LIMIT 20;
```

**Azərbaycan dilində axtarış.** İki tələ var, hər ikisi həll olunub:

1. *Şəkilçilər* — `kənd` sorğusu `kəndi` sözünü NATURAL LANGUAGE rejimində tapmır. Ona görə hər söz **BOOLEAN MODE + prefiks** ilə gedir: `AGAINST('kend*' IN BOOLEAN MODE)`.
2. *ə və ı* — collation `ş→s`, `ğ→g`, `ö→o` uyğunlaşdırır, amma `ə` (U+0259) və `ı` (U+0131) müstəqil hərflərdir və `e`/`i` ilə uyğunlaşmır. Ona görə axtarılan cədvəllərdə `search_text` generated sütunu var (ə→e, ı→i) və üzərində FULLTEXT indeks qurulub.

API tərəfindəki `common/search/normalize.ts` **eyni qaydanı** tətbiq edir — biri dəyişəndə migration da dəyişməlidir. Nəticədə `kend`, `kənd`, `xinaliq`, `xınalıq`, `sahdag` — hamısı işləyir.

**Coğrafi sorğular praktikada.** `ST_MakeEnvelope` MySQL 8.4-də coğrafi SRS üçün dəstəklənmir — bbox `ST_GeomFromText(..., 4326, 'axis-order=long-lat')` ilə qurulur. Radius filtri əvvəlcə bbox ilə daralır (spatial indeksdən istifadə üçün), sonra `ST_Distance_Sphere` ilə dəqiqləşir. Xəritə pinləri zoom ≥ 13-də fərdi, aşağıda server tərəfdə şəbəkə üzrə klasterlənir.

**Sıralama.** `route_stops(route_id, day_number, sort_order)` UNIQUE-dir, ona görə sürüklə-burax sıralaması iki mərhələdə gedir: əvvəlcə `10000+` aralığına köçürmə, sonra son sıra. `sort_order` UNSIGNED SMALLINT-dir — müvəqqəti dəyər üçün mənfi rəqəm olmaz. Hər əlavə/silmə/sıralamadan sonra günün elementləri **0-dan yenidən nömrələnir**, beləliklə mənbədən asılı olmayaraq sıra həmişə `[0,1,2,…]` olur.

**Gün əlaqələri CASCADE-dir, SET NULL yox.** MySQL eyni cədvəli iki fərqli kaskad yolu ilə dəyişdirməyə icazə vermir: `trips` silinəndə `trip_days` və `trip_items` hər ikisi CASCADE ilə silinir, eyni anda `trip_days`-dən `trip_items`-ə SET NULL gəlsəydi `ERROR 1452` yaranardı — bu, **istifadəçi hesabının silinməsini** (users → trips → …) bloklayırdı. Günü tək silərkən elementlər əvvəlcə əvvəlki günə köçürülür, ona görə data itmir.

**Marşrut məsafəsi** hər dayanacaq dəyişikliyində `ST_Distance_Sphere` ilə yenidən hesablanır (ardıcıl cütlər üzrə pəncərə funksiyası ilə).

**Təcrübə yayımı.** Yeni təcrübə `draft` statusunda yaranır və ictimai siyahıda görünmür. `POST /experiences/:slug/publish` tamlığı yoxlayır: ən azı 1 foto, 20+ simvol təsvir, görüş yeri, qiymət. Ekran 56-dakı "Qaralama" düyməsi bu axına uyğundur.

**XP mühərriki.** Bütün qazanma axınları `XpService.award()`-dan keçir: XP verir, leveli yenidən hesablayır, Gezgin Score-u bazadan yenidən yığır və badge tərəqqisini yeniləyir. `xp_transactions` audit izidir. Qaydalar `packages/shared/gamification.ts`-dədir — mobil tərəf eyni hesablamanı göstərə bilsin deyə.

**Check-in sırası vacibdir.** Check-in sətri **əvvəlcə** yazılır, sonra XP verilir — `award()` Score və badge-ləri bazadan yenidən hesabladığı üçün əks halda nəticə bir addım geri qalır (ilk check-in `scoreDelta: 0` göstərərdi və "İlk Addım" badge-i yalnız ikinci check-in-də görünərdi).

**Check-in yaxınlıq yoxlaması.** Mövqe göndərilirsə məkana `CHECKIN_RADIUS_M` (defolt 1000 m) məsafə yoxlanılır. Mövqe göndərilməsə yoxlama aparılmır — offline rejimdə sonradan sinxronlaşdırma üçün.

**Gündəlik limitlər.** `place_checkin` 3, `review_written` 3, `media_shared` 5, `route_created` 2 — limit dolanda əməliyyat qeydə alınır, amma XP 0 olur (`cappedByDailyLimit: true`).

**Ödəniş provayderi.** `PAYMENT_PROVIDER=mock` (defolt) → `MockPaymentProvider`. Test kartları: `4111 1111 1111 1111` uğurlu · `4000 0000 0000 0002` rədd · `4000 0000 0000 3220` 3-D Secure (OTP `123456`) · `4000 0000 0000 0069` müddəti bitmiş. Real PSP gələndə yalnız yeni bir sinif yazılır və `payments.module.ts`-dəki fabrikə əlavə edilir — qalan kod dəyişmir. PAN heç vaxt saxlanılmır, yalnız provayder tokeni.

**Rezervasiya idempotentliyi.** `Idempotency-Key` başlığı ilə gələn təkrar sorğu yeni sifariş yaratmır, mövcudunu qaytarır — şəbəkə təkrarında ikiqat ödənişin qarşısını alır.

**Ləğv siyasəti.** 48+ saat qalıb → 100% geri qaytarma · 24–48 saat → 50% · 24 saatdan az → 0%. Ləğvdə slotdakı yer avtomatik boşalır. `cancelled` və `refunded` yekun statuslardır — təkrar ləğv qəbul edilmir (əks halda yer ikinci dəfə boşalardı).

**Testlər ardıcıl işləyir** (`maxWorkers: 1`). Hamısı eyni dev bazasına vurur — paralel işləyəndə Prisma bağlantı hovuzu tükənir və çoxsorğulu əməliyyatlar (`trip.complete` → XP + Score + badge) timeout-a düşürdü. Ardıcıl işlətmə həm stabil, həm də daha sürətlidir (~5.5 s).

**Test etiketləri** `uniqueTag()`-dən gəlir (vaxt + təsadüfi bayt). Əvvəl yalnız `Date.now()` işlədilirdi; eyni millisaniyədə başlayan iki suite eyni etiketi alır və biri digərinin istifadəçisini silməyə çalışırdı — `bookings`/`payouts` FK-ları RESTRICT olduğu üçün (maliyyə qeydləri silinməməlidir) suite bütövlükdə sınırdı.

**Qlobal pipe/filter/interceptor** `AppModule`-da qeydiyyatdadır, `main.ts`-də yox — testlər və worker eyni davranışı alsın deyə.

**Açıq endpointlərdə isteğe bağlı auth.** `@Public()` endpoint token gəlsə onu oxuyur (axtarış tarixçəsi, rəydə "faydalı" işarəsi), gəlməsə anonim davam edir.

**Ödəniş.** PSP və mağaza IAP qərarları təxirə salınıb. Ödəniş qatı `PaymentProvider` interfeysi arxasındadır, `PAYMENT_PROVIDER=mock` ilə işləyir. Real provayder qoşulanda yalnız bir sinif yazılır (bax TECH-PLAN.md §6.1).

**Autentifikasiya.** Bütün endpointlər defolt qorunur (`JwtAuthGuard` qlobaldır); açıq olanlar `@Public()` ilə işarələnir. Access token 15 dəqiqə, refresh 30 gün — rotasiya ilə: hər `POST /auth/refresh` yeni cüt verir və köhnəni ləğv edir. Ləğv olunmuş token təkrar gəlirsə, **bütün ailə bağlanır** (`TOKEN_REUSED`) — oğurlanmış token ssenarisi. Şifrələr argon2id ilə (19 MiB, 2 keçid).

**Qonaq rejimi.** `POST /auth/guest` baxış üçün hesab yaradır; yazma əməliyyatları `GuestBlockedGuard` ilə bağlanır (403 `FORBIDDEN`).

**Media yükləmə.** Fayllar API-dən keçmir: `POST /media/presign` → `PUT` birbaşa S3-ə → `POST /media/:id/complete` (obyektin mövcudluğu yoxlanılır). Dev-də MinIO, prod-da R2/S3.

**Sosial giriş.** `SOCIAL_MODE=mock` (defolt) `mock:<email>` formatlı tokeni qəbul edir — kredensiallar olmadan test etmək üçün. `live` rejimdə Google `id_token` və Apple `identity_token` real yoxlanılır; bu kitabxanalar ESM olduğu üçün **yalnız live rejimdə gec yüklənir**.

**Sütun adları.** Cədvəllər və sütunlar snake_case-dir (`place_translations.place_id`), Prisma kodunda isə camelCase (`placeTranslation.placeId`) — `@map` ilə bağlanıb. Raw SQL yazarkən snake_case istifadə edin.

## Mobil tətbiq (`apps/mobile`)

**React Native 0.87.1 + React 19, CLI ilə** (Expo deyil). Native layihələr repoda: `ios/`, `android/`.

### İşə salma

```bash
pnpm install
cd apps/mobile/ios && bundle install && bundle exec pod install   # yalnız ilk dəfə
cd apps/mobile && pnpm start                                      # Metro
pnpm ios                                                          # simulyatorda aç
```

API `http://localhost:3100` ünvanında işləməlidir. Android emulyatorunda host `10.0.2.2`-dir — bu `src/config/env.ts`-də avtomatik seçilir.

### Qurulmuş ekranlar

| Axın | Ekranlar |
|---|---|
| Giriş | Açılış (01) · Daxil ol (02) · Qeydiyyat (03) · Şifrə bərpası + OTP (37/38) · Maraqlar (04) |
| Tablar | Kəşf et (10) · Planım (23) · Profil (28) |
| Detal | Məkan (13) · Marşrut (15) · Təcrübə (17) · Səyahət detalı (23) |
| Planlaşdırma | Yarat (FAB) · Yeni səyahət (24) · Plana əlavə et (48) · Marşrut qurucu (50) · Dayanacaq seçimi |
| Siyahı | Axtarış (11) · Yerlər (12) · Xəritə (12) · Marşrutlar (14) · Təcrübələr (16) · Want to go (33) |
| Gamification | Gezgin Score (29) · Nailiyyətlər (30) · Liderlər (31) · Check-in (51/52) |
| Rezervasiya | Bron (18) · Otel rezervasiyası (49) · Təsdiq və bilet (19) · Rezervasiyalarım (53) · Business profili (22) |

Discover tabı (sosial lent) Sprint 7-dədir — o vaxta qədər tətbiq **Explore** ilə açılır.
Ortadakı FAB isə ekran 26-nın (Paylaş) yerinə hazır yaratma axınlarını toplayan hub göstərir.

### Xəritə və mövqe

`react-native-maps` (iOS-da Apple Maps — açar tələb etmir) və
`@react-native-community/geolocation` native modul kimi qurulub, ona görə paket
əlavə edəndən sonra `pod install` və yenidən build lazımdır.

Xəritə `GET /places/map`-dən qidalanır: zoom ≥ 13-də fərdi pinlər, aşağıda
klasterlər gəlir; `bbox` formatı `minLng,minLat,maxLng,maxLat`-dır.

**Check-in mövqe göndərir.** Ekran açılanda əvvəlcə icazə istənilir, sonra GPS
oxunur — server məkana `CHECKIN_RADIUS_M` (defolt 1000 m) məsafəsini yoxlayır.
İcazə verilməsə və ya GPS cavab verməsə `lat`/`lng` göndərilmir və server
yoxlamanı ötürür; axın işləyir, sadəcə məkanda olma təsdiqlənmir.

> İcazə dialoqu `getCurrentPosition`-dan **ayrıca** çağırılır
> (`skipPermissionRequests: true`). Əks halda 8 saniyəlik GPS taymauti istifadəçi
> dialoqa cavab verərkən yanır və check-in mövqesiz keçir.

### Token yeniləməsi

Access token 15 dəqiqəlikdir. `src/api/client.ts` 401 (`TOKEN_EXPIRED`) alanda avtomatik `/auth/refresh` çağırır və sorğunu bir dəfə təkrarlayır; paralel 401-lər tək refresh sorğusunu paylaşır. Refresh token **rotasiya olunur**, ona görə yeni cüt mütləq yaddaşa yazılır — köhnəsi təkrar göndərilsə, server bütün sessiya ailəsini ləğv edir (`TOKEN_REUSED`).

### Bilinən tələlər

**Hoisted `node_modules` və köhnə parser.** pnpm `node-linker=hoisted` ilə işləyir (Metro pnpm-in simvolik quruluşunu tanımır). RN versiyası yüksələndə `@react-native/babel-preset` içində köhnə `hermes-parser` ilişib qala bilər — nəticədə RN-in öz Flow fayllarında `SyntaxError` alınır. Həlli:

```bash
rm -rf node_modules/@react-native/babel-preset/node_modules && pnpm install --force
```

**`react-native-gesture-handler` RN 0.87 ilə uyğun deyil** (silinmiş `RCTRootContentView.h` başlığına istinad edir). React Navigation-un native-stack və bottom-tabs naviqatorları onsuz işləyir, ona görə paket layihəyə daxil edilməyib.

**`StyleSheet.absoluteFillObject` RN 0.87-də yoxdur** — mövqe stilləri açıq yazılır.

**Alt CTA paneli `Screen`-in `footer` propu ilə verilir.** `Screen` kontenti
`ScrollView` içində göstərir, ona görə `position:absolute; bottom:0` olan panel
scroll **kontentinə** görə yerləşir: qısa ekranda ortada asılı qalır, uzun
ekranda yalnız sona sürüşdürəndə görünür. `footer` ScrollView-dən kənarda
render olunur.

### Yoxlama

Tətbiq iOS simulyatorunda qurulub işə salınır; ekran görüntüləri `xcrun simctl io <device> screenshot` ilə alınır. Sessiya tələb edən ekranları yoxlamaq üçün sessiyanı tətbiqin AsyncStorage manifestinə yazmaq olar:

```bash
C=$(xcrun simctl get_app_container "iPhone 17 Pro" app.gezgin data)
# $C/Library/Application Support/app.gezgin/RCTAsyncLocalStorage_V1/manifest.json
# açar: gezgin.session
```

**API cavab formaları.** Mobil tiplər Swagger-dən avtomatik yaranmır, ona görə əl ilə uyğunlaşdırılır — bir neçə yerdə fərq çıxıb:

| Endpoint | Gözlənilən | Real |
|---|---|---|
| `/categories` | `nameAz` | `name: {az, en, ru}` |
| `GET /bookings` | `?status=` | `?filter=` (upcoming/past/cancelled) |
| `POST /bookings` | `totalAzn` | `pricing.totalAzn` |
| `POST /bookings/:id/pay` | `{status, booking}` | birbaşa `Booking` |
| `/bookings/:id/ticket` | `travelers` | `guests: {adults, children}` |
| `GET /bookings/:id` | `payment.paidAzn` | `payment.amountAzn` |
| `/experiences` | `durationText: half_day` | `yarim-gun`, `3-saat` (azərbaycanca slug) |

Enum dəyərləri (`yarim-gun`, `asan`, `planned`) xam gəlir; insan oxunaqlı etiketlər
`src/lib/labels.ts`-dədir. Müddət üçün `durationLabel()` sabit cədvəllə yanaşı
`N-saat` / `N-gun` şablonunu da tanıyır — seed məlumatında saat sayı dəyişkəndir.

**Niyə tiplər generasiya olunmur.** `pnpm mobile api:types` işləyir və `src/api/schema.d.ts` yaradır, amma orada yalnız **sorğu** DTO-ları var: NestJS controller-ləri `@ApiOkResponse({ type })` elan etmədiyi üçün Swagger cavab formalarını sənədləşdirmir. Tam həll backend-də response DTO-larının əlavə olunmasıdır.

**Müvəqqəti həll — kontrakt testi.** `src/api/__tests__/contract.test.ts` canlı API-yə sorğu göndərib ekranların asılı olduğu sahələrin mövcudluğunu yoxlayır (25 test). Yuxarıdakı uyğunsuzluqların hamısı indi CI-də tutulur:

```bash
cd apps/mobile && pnpm test     # API işləmirsə testlər atlanılır
```

**Seed şəkilləri** MinIO-ya ayrıca yüklənməlidir (baza yalnız açarları saxlayır):

```bash
docker cp design/assets gezgin-minio:/tmp/seed-assets
docker exec gezgin-minio mc cp --recursive /tmp/seed-assets/ local/gezgin/seed/
```
