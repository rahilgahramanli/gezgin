# GEZGIN.app — Məhsul və Dizayn Planı

> Mənbə: `Presentation - Gezgin - Prototip).pdf` (16 slayd). Bu sənəd prezentasiyadakı konsepsiyanı tətbiqin ekran-ekran planına çevirir. Növbəti mərhələ (development) bu plan və `design/` qovluğundakı HTML ekranlar əsasında aparılacaq.

---

## 1. Konsepsiya

**Slogan:** *Gəz, yaşa, paylaş!* — "Hər səyahət bir hekayədir."

**Problem (slayd 3):** Səyahət məlumatı Instagram/TikTok, Google, Booking/Airbnb, TripAdvisor arasında parçalanıb. Gezginlər vaxt itirir.

**Həll (slayd 4):** Bir səyahət — bir platforma. Bütün mərhələlər tək tətbiqdə:

| Mərhələ | Tətbiqdə qarşılığı |
|---|---|
| İlham al | Discover (sosial lent, hekayələr, real gezgin paylaşımları) |
| Kəşf et | Explore (yerlər, marşrutlar, təcrübələr, tədbirlər, xəritə) |
| Planla | Trips / Planım (tarix, gün-gün plan, marşrut, offline xəritə) |
| Yaşa | Detal səhifələri, rezervasiya, "Marşrutu başlat", check-in → XP |
| Paylaş | Create (foto/video/marşrut/rəy), profil, Gezgin Score |

**Ekosistem (slayd 11–13):** üç tərəf — **Gezgin** (səyahət edən), **Local Expert** (yerli bələdçi/mütəxəssis), **Business** (otel, restoran, tur şirkəti).

**Gəlir modeli (slayd 12–14):** komissiya (rezervasiya), Gezgin PRO / Local Expert PRO / Business PRO abunəlikləri, reklam & tərəfdaşlıq, əlavə xidmətlər (sığorta, transfer, bilet).

**Gamification (slayd 7–8):** Gezgin Score + XP + Level (1 Başlanğıc → 5 Gezgin) + badge-lər + leaderboard.

---

## 2. İstifadəçi rolları

| Rol | Nə edir | Nə qazanır |
|---|---|---|
| **Gezgin** | Kəşf edir, planlayır, yaşayır, paylaşır, rəy yazır | XP, Gezgin Score, badge, PRO imkanlar |
| **Local Expert** | Təcrübə/tur təqdim edir, hekayə paylaşır, suallara cavab verir | Gəlir (80% / 20% platforma komissiyası), nüfuz, rating |
| **Business** | Listing, paket/təklif, kampaniya, rezervasiya qəbulu | Müştəri, görünürlük, analitika |
| Admin (web) | Moderasiya, kontent, kateqoriya, region, tədbir idarəsi | — |

**Bu mərhələdə dizaynı hazırlanan tətbiq:** Gezgin mobil tətbiqi (Local Expert və Business profilləri gezgin tərəfindən *baxılan* səhifələr kimi + Local Expert üçün qazanc paneli). Business/Expert-in tam idarəetmə paneli sonrakı fazada (web) nəzərdə tutulur.

---

## 3. Naviqasiya strukturu

Aşağı tab bar (prezentasiyada olduğu kimi 5 element, ortada yaşıl "+" düyməsi):

```
 Discover   Explore   [ + ]   Trips   Profile
 (Kəşf)     (Axtar)  (Paylaş) (Planım) (Profil)
```

```
Splash ─► Login / Register ─► Maraqlar (onboarding) ─► Tab bar
                                                        │
  ┌──────────────┬──────────────┬──────────┬────────────┼─────────────┐
  Discover       Explore        +          Trips        Profile
  ├ Post detalı  ├ Axtarış      ├ Paylaş   ├ Yeni plan  ├ Gezgin Score
  ├ Bildirişlər  ├ Yerlər+xəritə├ Rəy yaz  ├ Offline    ├ Nailiyyətlər
  ├ Mesajlar     │ └ Məkan detalı           xəritələr   ├ Liderlər
  │ └ Söhbət     ├ Marşrutlar                            ├ Regionlar
  │              │ └ Marşrut detalı                       ├ Want to go
  │              ├ Təcrübələr                             ├ Tənzimləmələr
  │              │ └ Təcrübə detalı ─► Rezervasiya ─► Təsdiq   └ Gezgin PRO
  │              ├ Tədbirlər
  │              ├ Local Expert profili (─► Expert paneli)
  │              └ Business profili
```

**Ekranlar arası əsas keçidlər (dövrəni qapayan ekranlar 37–56):**

| Haradan | Düymə / hərəkət | Hara |
|---|---|---|
| 02 Daxil ol | "Şifrəni unutmusan?" | 37 → 38 OTP → yeni şifrə |
| 03 Qeydiyyat | "Davam et" | 38 OTP → 04 Maraqlar → 39 Profil (3/3) → Tab bar |
| 05 Discover | hekayə dairəsi / istifadəçi adı / paylaş ikonu | 40 Hekayə / 41 Gezgin profili / 43 Paylaş paneli |
| 41 Gezgin profili, 28 Profil | izləyici sayı | 42 İzləyicilər |
| 12 Yerlər, 14, 16 | filtr ikonu | 45 Filtr paneli |
| 13 Məkan detalı | Fotolar / Rəylər tabı, "Marşruta əlavə et" | 46 Fotolar / 47 Rəylər / 48 Plana əlavə et |
| 20 Tədbirlər, 07 Bildirişlər | tədbir kartı | 44 Tədbir detalı → 48 Plana əlavə et |
| 22 Business profili | paket "Rezervasiya" | 49 Otel rezervasiyası → 19 Təsdiq → 53 Rezervasiyalarım |
| 14 Marşrutlar, 24 Yeni səyahət | "Öz marşrutunu yarat" / "Sıfırdan qur" | 50 Marşrut qurucu |
| 15 Marşrut detalı, 23 Planım | "Marşrutu başlat" / Aktiv | 51 Aktiv marşrut → 52 Check-in (XP, level-up) → 26 Foto paylaş |
| 28 Profil | qələm ikonu / Rezervasiyalar | 54 Profili redaktə et / 53 Rezervasiyalarım |
| 34 Tənzimləmələr | "Local Expert ol" | 55 Müraciət → 36 Expert paneli → 56 Təcrübə yarat |

---

## 4. Ekran inventarı (56 ekran)

Hər ekran `design/screens/<fayl>.html` kimi hazırlanır. "Slayd" sütunu prezentasiyadakı mənbəni göstərir.

### A. Giriş və onboarding
| № | Fayl | Ekran | Slayd | Məzmun |
|---|---|---|---|---|
| 01 | `splash` | Açılış | 5 | Loqo, "Səyahət etmək yaşamaqdır", Qeydiyyat / Daxil ol / Qonaq kimi davam et |
| 02 | `login` | Daxil ol | — | E-mail/telefon + şifrə, Google/Apple ilə giriş, şifrəni unutdum |
| 03 | `register` | Qeydiyyat | 5 | Ad, e-mail, şifrə, şərtlər, sosial qeydiyyat |
| 04 | `onboarding-interests` | Profilini tamamla 2/3 | 5 | Maraqlar (Təbiət, Tarix, Mədəniyyət, Macəra, Qastronomiya…), ev regionu |
| 37 | `forgot-password` | Şifrəni bərpa et | — | E-mail / telefon ilə kod göndər |
| 38 | `otp-verify` | Təsdiq kodu | — | 6 rəqəmli OTP, yenidən göndər taymeri |
| 39 | `onboarding-profile` | Profilini tamamla 3/3 | 5 | Foto, istifadəçi adı, bio, bildiriş / yerləşmə icazələri, +100 XP |

### B. Discover (sosial lent)
| № | Fayl | Ekran | Slayd | Məzmun |
|---|---|---|---|---|
| 05 | `discover` | Discover — For You | 6, 14 | Hekayələr, For you / Following / Nearby, post kartı (bəyən, şərh, paylaş, saxla) |
| 06 | `post-detail` | Paylaşım detalı | 6 | Tam post, məkan etiketi, şərhlər, şərh yazma |
| 07 | `notifications` | Bildirişlər / Sizin üçün | 5 | Xüsusi təkliflər, gələcək tədbirlər, sosial bildirişlər |
| 08 | `messages` | Mesajlar | 6, 11 | Söhbət siyahısı (Local Expert, Business, gezginlər) |
| 09 | `chat` | Söhbət | 11 | Mesaj axını, təcrübə kartı paylaşma, yazma sahəsi |
| 40 | `story-view` | Hekayə baxışı | 6 | Tam ekran foto, proqres, cavab yaz |
| 41 | `user-profile` | Gezgin profili (başqası) | 6, 7 | İzlə / Mesaj, paylaşımlar, marşrutlar, nailiyyətlər |
| 42 | `followers` | İzləyicilər / İzləyir | 6 | Siyahı, İzlə düymələri, tövsiyə olunan gezginlər |
| 43 | `share-sheet` | Paylaş paneli (overlay) | 6 | Sürətli göndər, link kopyala, hekayə, marşruta bağla, şikayət |

### C. Explore (kəşf)
| № | Fayl | Ekran | Slayd | Məzmun |
|---|---|---|---|---|
| 10 | `explore` | Kəşf et | 9, 11 | Region seçici, axtarış, kateqoriyalar, populyar məkanlar, seçilmiş təcrübələr |
| 11 | `search` | Axtarış | 9 | Son axtarışlar, nəticələr (yer / marşrut / təcrübə / gezgin) |
| 12 | `places` | Yerlər + xəritə | 10 | Filtr çipləri, xəritə pinləri, yaxınlıqdakı yerlər siyahısı |
| 13 | `place-detail` | Məkan detalı | 5, 9 | Hero foto, reytinq, Ümumi/Fotolar/Rəylər/Yaxınlıqdakılar, faktlar, "Marşruta əlavə et" |
| 14 | `routes` | Marşrutlar | 10 | Müddət filtri, "Sənin marşrutların", tövsiyə olunan marşrutlar |
| 15 | `route-detail` | Marşrut detalı | 9 | Xəritə + pinlər, məsafə/müddət/məkan, günlər üzrə plan, "Marşrutu başlat" |
| 16 | `experiences` | Təcrübələr | 10 | Kateqoriya çipləri, böyük kartlar (qiymət / nəfər, reytinq) |
| 17 | `experience-detail` | Təcrübə detalı | 12 | Qiymətə daxildir, Local Expert, "Local Expert qazanır 80%", Gezgin qazancı (XP), "Təcrübəni bron et" |
| 18 | `booking` | Rezervasiya | 12 | Tarix, nəfər sayı, qiymət bölgüsü, ödəniş üsulu |
| 19 | `booking-success` | Təsdiq | 9 | "Planla, yola çıx, xatirələr topla!", bilet kodu, plana əlavə |
| 20 | `events` | Tədbirlər | 5, 9 | Festival, konsert, yerli tədbirlər — tarix üzrə |
| 21 | `local-expert-profile` | Local Expert profili | 11 | Reytinq / rəy / təcrübə, təklif etdiyi təcrübələr, "Mesaj göndər" |
| 22 | `business-profile` | Business profili | 11 | Cover, Haqqında/Xidmətlər/Rəylər/Yerlər, təkliflər & paketlər, Zəng et / Mesaj |
| 44 | `event-detail` | Tədbir detalı | 5, 9 | Tarix / yer, proqram, kim gedir, təşkilatçı, "Plana əlavə et" |
| 45 | `filter-sheet` | Filtr paneli (overlay) | 10 | Kateqoriya, məsafə, reytinq, qiymət, əlavə seçimlər |
| 46 | `photo-gallery` | Fotolar | 9 | Məkanın bütün fotoları (gezginlərdən / rəsmi), foto əlavə et |
| 47 | `reviews-all` | Bütün rəylər | 9 | Reytinq bölgüsü, filtrlər, rəy kartları, "Rəy yaz" |
| 48 | `add-to-plan` | Plana əlavə et (overlay) | 5, 9 | Səyahət və gün seçimi, vaxt / qeyd |
| 49 | `hotel-booking` | Otel rezervasiyası | 11 | Giriş/çıxış tarixləri, qonaqlar, otaq, əlavələr, ödəniş |

### D. Trips (Planım)
| № | Fayl | Ekran | Slayd | Məzmun |
|---|---|---|---|---|
| 23 | `trips` | Planım | 5 | Marşrut / Tədbirlər / Qeydlər tabları, aktiv səyahət, xəritə, gün-gün siyahı |
| 24 | `trip-create` | Yeni səyahət | 5 | Ad, tarixlər, region, hazır marşrutdan başla / sıfırdan |
| 25 | `offline-maps` | Offline xəritələr | 9, 10 | Region paketləri, yüklə / yenilə, yaddaş |
| 50 | `route-builder` | Marşrut qurucu | 9, 10 | Dayanacaqları əlavə et / sırala, günlərə böl, xəritə, +350 XP |
| 51 | `active-route` | Aktiv marşrut (naviqasiya) | 5, 9 | Tam xəritə, növbəti dayanacaq, "Çatdım — check-in", offline |
| 52 | `checkin-xp` | Check-in / XP qazanıldı (modal) | 8 | +600 XP, level-up, yeni badge, "Foto paylaş" |

### E. Create (Paylaş)
| № | Fayl | Ekran | Slayd | Məzmun |
|---|---|---|---|---|
| 26 | `create-post` | Paylaş | 5 | Mətn, Foto / Video / Marşrut / Yerləşmə, son paylaşımlar |
| 27 | `write-review` | Rəy yaz | 8 | Ulduz, mətn, foto əlavə et, "+400 XP" |

### F. Profil və gamification
| № | Fayl | Ekran | Slayd | Məzmun |
|---|---|---|---|---|
| 28 | `profile` | Profil | 7 | Cover, avatar, Level & Gezgin Score kartı, statistika, Regions/Places/Experiences/Routes/Want to go |
| 29 | `gezgin-score` | Gezgin Score | 8 | Dairəvi göstərici, level, XP çubuğu, xal qazanma yolları |
| 30 | `badges` | Nailiyyətlər | 8 | Level yolu (1–5), badge-lər (İlk Zirvə, Fotoqu, Marşrutçu, Təcrübəçi, Əfsanə) |
| 31 | `leaderboard` | Liderlər | 8 | Həftəlik / aylıq / bütün zamanlar, region üzrə |
| 32 | `regions` | Regionlar | 7 | 32/50 region — xəritə, kəşf edilmiş / edilməmiş |
| 33 | `saved` | Want to go | 7 | Saxlanılan yerlər, marşrutlar, təcrübələr |
| 34 | `settings` | Tənzimləmələr | 7 | Hesab, dil (AZ/EN/RU), bildirişlər, məxfilik, çıxış |
| 35 | `pro` | Gezgin PRO | 12, 14 | Premium funksiyalar, aylıq / illik plan |
| 36 | `expert-dashboard` | Local Expert paneli | 12 | Qazanc, rezervasiyalar, təcrübələrim, ödənişlər |
| 53 | `my-bookings` | Rezervasiyalarım | 9, 12 | Gələcək / keçmiş / ləğv, bilet kodu, ödə, rəy yaz |
| 54 | `edit-profile` | Profili redaktə et | 7 | Cover, avatar, ad, bio, şəhər, maraqlar, sosial |
| 55 | `become-expert` | Local Expert ol | 11, 12 | Müraciət: sahə, region, dillər, sənədlər, şərtlər |
| 56 | `expert-create-experience` | Təcrübə yarat (Expert) | 12 | Fotolar, ad, kateqoriya, müddət, qiymət (80/20), daxil olanlar, görüş yeri |

---

## 5. Dizayn sistemi

Prezentasiyadan çıxarılan vizual dil: krem fon, tünd yaşıl (loqo) əsas rəng, qəhvəyi vurğu, ağ kartlar, yumşaq kölgə, böyük radiuslar, foto-üstü qradiyent, iOS status bar.

### Rənglər
| Token | Dəyər | İstifadə |
|---|---|---|
| `--green-900` | `#0F3D3A` | Əsas düymələr, loqo, aktiv tab, başlıq vurğusu |
| `--green-700` | `#1B5B55` | Hover / ikinci dərəcəli yaşıl |
| `--green-100` | `#E4EEEB` | Yaşıl açıq fon (çip, pill) |
| `--teal-400` | `#33B8A3` | Progress halqası, müsbət göstərici |
| `--brown-700` | `#7A4A28` | İkinci başlıq rəngi, Local Expert vurğusu, qəhvəyi düymə |
| `--brown-100` | `#F3E7DA` | Qəhvəyi açıq fon |
| `--cream` | `#FFFFFF` | Səhifə fonu (ağ) |
| `--paper` | `#FFFFFF` | Kartlar |
| `--ink` | `#182726` | Mətn |
| `--muted` | `#6B7776` | İkinci dərəcəli mətn |
| `--line` | `#E7E2D9` | Xətlər, sərhədlər |
| `--star` | `#F2A93B` | Reytinq ulduzu |
| `--danger` | `#E14B3F` | Bəyənmə (qırmızı ürək), xəta |

### Tipoqrafiya
- Başlıqlar: **Lexend** (Google Fonts — Azərbaycan "ə, ğ, ı" hərflərini dəstəkləyir; Outfit dəstəkləmir) — 600/700, sıx sətir aralığı.
- Mətn / UI: **Inter** — 400/500/600.
- Ölçülər: 28 (səhifə başlığı) · 22 (bölmə) · 17 (kart başlığı) · 15 (mətn) · 13 (meta) · 11 (tab etiketi).

### Komponentlər (hamısı `design/gezgin.css`-də)
- Phone frame 390×844, status bar (9:41), home indicator
- Top bar (geri / başlıq / əməliyyat), böyük başlıq
- Axtarış sahəsi, filtr çipləri, kateqoriya dairələri
- Kartlar: foto-üstü kart (məkan), təcrübə kartı (qiymət), siyahı sətri (thumbnail + meta + məsafə), tile (profil)
- Bölmə başlığı + "Daha çox ›"
- Tab (alt xətt), segment (For you / Following / Nearby)
- Düymələr: primary (yaşıl), brown, outline, ghost, icon
- Bottom nav (5 element, mərkəz FAB)
- Avatar (ölçülər, hekayə halqası), badge/pill (Level 12, Local Expert)
- Statistika sırası, XP progress, dairəvi score
- Xəritə (stilizə SVG) + pin
- Form elementləri: input, toggle, seçim kartı
- Bottom sheet, toast

### Gamification qaydaları (slayd 8)
| Level | Ad | XP |
|---|---|---|
| 1 | Başlanğıc | 0 – 499 |
| 2 | Kəşf edən | 500 – 1 499 |
| 3 | Səyyah | 1 500 – 2 999 |
| 4 | Kəşfçi | 3 000 – 4 999 |
| 5 | Gezgin | 5 000+ |

XP mənbələri: məkan kəşfi +600, təcrübə +800, rəy +400, foto/video +300, marşrut +350 (prezentasiyadakı nümunə dəyərlər; development-də konfiqurasiya olunacaq).

Badge nümunələri: İlk Zirvə (10 məkan), Fotoqu (50 paylaşım), Marşrutçu (5 marşrut), Təcrübəçi (20 təcrübə), Əfsanə (Level 20).

---

## 6. Data modeli (əsas obyektlər)

`User` (rol: gezgin / expert / business, level, xp, score) · `Region` · `Place` (kateqoriya, koordinat, fotolar, faktlar) · `Route` (günlər → dayanacaqlar) · `Experience` (expert, qiymət, daxil olanlar, slotlar) · `Event` · `Trip` (istifadəçi planı: tarix, günlər, elementlər, qeydlər) · `Post` (media, məkan, hashtag) · `Comment` · `Like` · `Review` · `SavedItem` · `Booking` (status, ödəniş, komissiya) · `Badge` / `UserBadge` · `XpTransaction` · `Notification` · `Conversation` / `Message` · `Subscription` (PRO) · `Business` (listing, paketlər).

> Qeyd: `Azerbaijan Explorer/buta-api` (NestJS + Prisma) layihəsində `HeritageSite`, `Event`, `District`, `Review`, `SavedItem`, `Notification`, `Restaurant` kimi modellər artıq var — backend üçün başlanğıc nöqtəsi kimi qiymətləndirilə bilər.

---

## 7. Texniki stack (tövsiyə)

| Qat | Seçim | Səbəb |
|---|---|---|
| Mobil | **React Native (Expo)** — alternativ Flutter | iOS + Android tək kod, sürətli iterasiya, kartoqrafiya kitabxanaları |
| Backend | **NestJS + Prisma + PostgreSQL (+ PostGIS)** | `buta-api` ilə eyni stack, coğrafi sorğular |
| Xəritə | Mapbox (offline paketlər) / Google Maps | Marşrut, pin, offline |
| Media | S3-uyğun obyekt anbarı + CDN, video üçün transcoding | Foto/video paylaşımlar |
| Auth | JWT + refresh, Google / Apple Sign-in, OTP | |
| Push | FCM / APNs | Bildirişlər, təkliflər |
| Ödəniş | Yerli PSP (kart) + Apple/Google Pay | Rezervasiya, PRO abunəlik |
| Admin | Web panel (Next.js) | Moderasiya, kontent |

---

## 8. Mərhələlər

| Faza | Əhatə | Ekranlar |
|---|---|---|
| **0 — Dizayn (indi)** | Plan + 56 HTML mobil ekran + dizayn sistemi | hamısı |
| **1 — MVP** | Auth, Explore (yerlər/marşrutlar/təcrübələr), detal səhifələri, Trips (plan, marşrut qurucu, aktiv marşrut, check-in), Profil + Score, Saxla, Rezervasiyalarım | 01–04, 10–17, 23, 28–30, 33, 37–39, 45–48, 50–54 |
| **2 — Sosial** | Discover lenti, post, şərh, hekayə, gezgin profilləri, bildiriş, mesaj, rəy yaz, Local Expert / Business profilləri, tədbir detalı | 05–09, 21–22, 26–27, 31–32, 40–44 |
| **3 — Monetizasiya** | Rezervasiya + ödəniş (təcrübə, otel), Gezgin PRO, Local Expert ol, Expert paneli + təcrübə yarat, tədbirlər, offline xəritə | 18–20, 24–25, 34–36, 49, 55–56 |
| **4 — Region genişlənməsi** | Çoxdilli (AZ/EN/RU), yeni ölkələr, valyuta | — |

---

## 9. Dizayn fayllarının quruluşu

```
gezgin/
├── PLAN.md                     ← bu sənəd
└── design/
    ├── index.html              ← bütün ekranların qalereyası (telefon çərçivələrində)
    ├── gezgin-screens-all.html ← eyni qalereya tək faylda (CSS/ikon/şəkillər daxil — paylaşmaq üçün)
    ├── gezgin.css              ← dizayn sistemi (tokenlər + komponentlər)
    ├── icons.js                ← SVG ikon sprite
    ├── assets/                 ← prezentasiyadan çıxarılan fotolar
    └── screens/
        ├── 01-splash.html
        ├── 02-login.html
        └── ... (56 ekran)
```

Baxmaq üçün: `design/index.html` faylını brauzerdə açın (bütün ekranlar bir səhifədə), və ya `design/screens/` içindən istənilən ekranı ayrıca açın.
