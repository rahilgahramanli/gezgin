# GEZGIN — deploy (13.60.173.66)

Tək EC2 serverində Docker Compose ilə: NestJS API, MySQL, Redis, MinIO, admin paneli
və nginx. Mobil tətbiq buraya deploy olunmur — o, mağaza vasitəsilə paylanır və bu
API-yə qoşulur.

## Server

| | |
|---|---|
| Ünvan | `13.60.173.66` (Ubuntu 26.04, x86_64) |
| Giriş | `ssh -i awskey.pem ubuntu@13.60.173.66` |
| Resurs | 2 vCPU · 908 MB RAM · EBS disk |
| Kod | `~/gezgin` (rsync ilə köçürülür, git clone yox) |
| Konfiq | `~/gezgin/.env.production` — **yalnız serverdə**, repoda deyil |

**Swap şərtdir.** 908 MB RAM-da MySQL + Node prosesləri swap olmadan OOM verir:

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

## Şəbəkə

Security Group-da açıq olmalıdır: **22** (SSH), **80** (HTTP). HTTPS üçün domen
lazımdır — domen yönləndiriləndən sonra 443 açılır və certbot qurulur.

Heç bir xidmət host portuna çıxmır; yeganə giriş nöqtəsi nginx-dir:

| Yol | Hara gedir |
|---|---|
| `/` | admin paneli (Next.js) |
| `/api/v1/…` | NestJS API |
| `/docs` | Swagger |
| `/ws` | WebSocket (socket.io) |
| `/gezgin/…` | MinIO public bucket (şəkillər) |

> **Media yolu niyə `/gezgin/`?** Presign imzası həm host, həm yol üzərindən
> hesablanır. Bucket adını public prefiks kimi saxlayıb nginx-də yolu
> **dəyişmədən** ötürürük — əks halda imza uyğunsuzluğu 403 verir.
> `S3_ENDPOINT` də public ünvandır (`http://13.60.173.66`), çünki mobil tərəf və
> API eyni imzanı görməlidir. EC2 öz public IP-sinə çata bilir (yoxlanılıb).

## Deploy

Image-lər **lokal maşında** `linux/amd64` üçün qurulur və serverə axınla köçürülür —
serverin diski və 908 MB RAM-ı build üçün kifayət etmir:

```bash
# 1. Kodu köçür (node_modules, ios/, .env, *.pem xaric)
rsync -az --delete -e "ssh -i awskey.pem" \
  --exclude node_modules --exclude .git --exclude apps/mobile/ios \
  --exclude apps/mobile/android --exclude .next --exclude dist \
  --exclude '*.pem' --exclude .env \
  ./ ubuntu@13.60.173.66:~/gezgin/

# 2. Image-ləri qur və axınla köçür (diskdə tar qalmır)
docker buildx build --platform linux/amd64 --target production \
  -f docker/api.Dockerfile -t gezgin-api:prod --load .
docker buildx build --platform linux/amd64 --target production \
  -f docker/admin.Dockerfile -t gezgin-admin:prod --load .

docker save gezgin-api:prod | gzip -1 | \
  ssh -i awskey.pem ubuntu@13.60.173.66 'gunzip | sudo docker load'
docker save gezgin-admin:prod | gzip -1 | \
  ssh -i awskey.pem ubuntu@13.60.173.66 'gunzip | sudo docker load'

# 3. Serverdə qaldır
ssh -i awskey.pem ubuntu@13.60.173.66 \
  'cd ~/gezgin && sudo docker compose -f docker-compose.prod.yml \
   --env-file .env.production up -d'
```

## Miqrasiya və seed

```bash
sudo docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec api node apps/api/node_modules/prisma/build/index.js migrate deploy \
  --schema apps/api/prisma/schema.prisma
```

Seed CSV-ləri `~/gezgin/seed/` qovluğundadır; şəkillər ayrıca MinIO-ya yüklənir
(bax: `seed/README.md`).

## Yoxlama

```bash
curl -s http://13.60.173.66/api/v1/health          # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' http://13.60.173.66/   # panel → 200
```

Portlar bağlı olsa SSH tuneli ilə: `ssh -i awskey.pem -L 8080:localhost:80 ubuntu@13.60.173.66`

## Mobil tətbiqi bu serverə yönəltmək

`apps/mobile/src/config/env.ts` prod üçün `https://api.gezgin.app/api/v1` gözləyir —
həmin domen hələ yoxdur. Test buraxılışını serverə yönəltmək üçün:

```ts
// env.ts — müvəqqəti
apiUrl: __DEV__ ? `http://${DEV_HOST}:3100/api/v1` : 'http://13.60.173.66/api/v1',
```

**iOS-da bu tək başına işləmir:** App Transport Security düz HTTP-ni bloklayır.
Test üçün `Info.plist`-ə istisna lazımdır (App Store buraxılışında qəbul edilmir):

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>13.60.173.66</key>
    <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/></dict>
  </dict>
</dict>
```

Düzgün həll: domeni serverə yönəltmək, certbot ilə sertifikat almaq və
`https://api.gezgin.app` işlətmək — onda heç bir istisna lazım deyil.

## Əməliyyat qeydləri

**Konfiq faylını `rsync` ilə yeniləyəndə konteyneri yenidən başlat.** `rsync`
faylı müvəqqəti ad altında yazıb `rename` edir — yeni inode yaranır, konteynerdəki
bind mount isə köhnə inode-a baxmağa davam edir. `nginx -s reload` köhnə konfiqi
oxuyur; `docker compose restart nginx` lazımdır (və ya `rsync --inplace`).

**`/socket.io/` yolu proxy-lənməlidir, `/ws` yox.** `@WebSocketGateway({namespace:'/ws'})`
yalnız namespace təyin edir; socket.io əl sıxması həmişə `/socket.io/`-ya gedir.

**Disk Docker 29-da iki dəfə tutulur:** qatlar `/var/lib/containerd`-də, işləyən
konteynerin rootfs-i isə `/var/lib/docker/rootfs`-də saxlanılır. 351 MB-lıq image
işə düşəndə diskdən ~700 MB gedir.

## Android APK (test buraxılışı)

```bash
cd apps/mobile/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

| | |
|---|---|
| Paket | `com.gezginapp` · ad **GEZGIN** |
| API | `http://13.60.173.66/api/v1` (`src/config/env.ts`, `__DEV__` olmayan hal) |
| İmza | `apps/mobile/android/app/gezgin-release.keystore` (repoda **deyil**) |
| Şifrələr | `~/.gradle/gradle.properties` — `GEZGIN_UPLOAD_*` |
| İkon | adaptiv: `ic_launcher_foreground.xml` + brend yaşılı fon; köhnə cihazlar üçün PNG-lər |
| Splash | `drawable/splash_screen.xml` (Android ≤11) və `values-v31/styles.xml` (Android 12+) |

**Şifrələnməmiş HTTP.** Android 9+ düz HTTP-ni bloklayır; `res/xml/network_security_config.xml`
istisnanı **yalnız 13.60.173.66** üçün verir, qalan trafik HTTPS olmalıdır. Domen və
sertifikat alınandan sonra bu fayl silinməli, `env.ts` isə `https://api.gezgin.app`-a
qaytarılmalıdır.

> **Monorepo qeydi:** pnpm `node-linker=hoisted` paketləri repo kökünə yığır, RN-in
> Gradle skriptləri isə `apps/mobile/node_modules` gözləyir. `settings.gradle` və
> `app/build.gradle`-dakı yollar bir səviyyə yuxarı göstərilib.

## iOS IPA (imzasız)

```bash
cd apps/mobile/ios
xcodebuild -workspace GezginApp.xcworkspace -scheme GezginApp \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath /tmp/GezginApp.xcarchive archive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""

mkdir -p /tmp/ipa/Payload
cp -R /tmp/GezginApp.xcarchive/Products/Applications/GezginApp.app /tmp/ipa/Payload/
cd /tmp/ipa && zip -qry ~/Desktop/GEZGIN-1.0-prod-unsigned.ipa Payload
```

| | |
|---|---|
| Bundle | `app.gezgin` · ad **GEZGIN** · iOS 15.1+ |
| API | `http://13.60.173.66/api/v1` (`main.jsbundle`-də təsdiqləndi) |
| İkon | `Images.xcassets/AppIcon.appiconset` (1024 mənbədən Xcode qalanını yaradır) |
| Splash | `LaunchScreen.storyboard` — brend yaşılı + loqo |
| ATS | `Info.plist`-də istisna **yalnız 13.60.173.66** üçün |

**İmza yoxdur.** Maşında yalnız başqa şəxsin (Orkhan Ismayilov) sertifikatları var və
heç bir provisioning profil quraşdırılmayıb, ona görə telefona birbaşa quraşdırıla bilməz.
Üç yol var:

1. **Apple Developer hesabı** ($99/il) — `DEVELOPMENT_TEAM` təyin edilir, Xcode avtomatik
   imzalayır, `-exportArchive` ilə ad-hoc (cihaz UDID-ləri ilə) və ya TestFlight IPA çıxır.
2. **Pulsuz Apple ID** — Xcode-da hesab əlavə edilir, cihaz qoşulur; imza 7 gün etibarlıdır.
3. **Mövcud imzasız IPA-nı yenidən imzalamaq** — Sideloadly / AltStore öz Apple ID-nlə
   imzalayır (ən sürətli test yolu).

## Prod-da yaşanmış üç nasazlıq (və səbəbləri)

**1. Disk dolanda API tamamilə dayanır.** 8 GB disk 100% dolmuşdu → MySQL **yaza**
bilmirdi → yazma sorğuları ilişirdi → Prisma hovuzu dolurdu → `health` daxil hər şey
cavabsız qalırdı. Oxuma işlədiyi üçün problem gec görünür. Disk **30 GB**-a
böyüdüldü (`growpart` + `resize2fs`, restart lazım deyil).

**2. Prisma hovuzu cəmi 3 bağlantı açırdı.** Defolt ölçü `CPU×2+1`-dir, konteyner
1 CPU gördüyü üçün hovuz kiçik qalırdı və bir neçə paralel yazma onu bloklayırdı.
`DATABASE_URL`-ə `?connection_limit=12&pool_timeout=20` əlavə edildi.

**3. Admin paneli API-ni tapa bilmirdi (`ECONNREFUSED`).** `next.config.ts`-dəki
`env` bloku dəyəri **build zamanı** koda yazır; image başqa maşında qurulduğu üçün
içinə `http://localhost:3100` düşmüşdü və konteynerdəki `GEZGIN_API_URL` oxunmurdu.
Blok silindi — server komponentləri `process.env`-i işləmə zamanı oxuyur.

## Nəyin çatışmadığı

- **HTTPS yoxdur** — domen yönləndiriləndən sonra certbot. iOS ATS düz HTTP-ni
  bloklayır, ona görə mobil tətbiq üçün domen + sertifikat şərtdir.
- **E-poçt mailhog-a düşür** (real provayder seçilməyib) — OTP məktubları
  `ssh -L 8025:localhost:8025` ilə baxılır.
- **Backup yoxdur** — MySQL volume-u üçün gündəlik `mysqldump` + S3 planlaşdırılmalıdır.
- **Monitorinq yoxdur** — Sentry/uptime yoxlaması qurulmayıb (AUDIT.md §5).
