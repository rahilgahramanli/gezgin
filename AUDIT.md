# GEZGIN — məhsul auditi

**Tarix:** 2026-09-21 · **Əhatə:** Sprint 0–7 (backend 173 endpoint / 24 modul, mobil 43 ekran)
**Kimin üçün:** məhsul sahibi və komanda — nəyin buraxılışa hazır olduğunu, nəyin olmadığını və
hansı ardıcıllıqla davam etməyi qərara almaq üçün.

---

## 1. Xülasə

Texniki baza güclüdür: 173 endpoint, 220 API testi, 35 kontrakt testi, 11 real toxunuşlu UI axını,
WebSocket çat, keyset səhifələmə, məkan sorğuları MySQL spatial indeksləri ilə. Səyahətçi üçün
əsas dövrə — **kəşf → plan → check-in → XP → paylaşım → rezervasiya** — işləyir.

Amma məhsul **buraxıla bilən vəziyyətdə deyil**. Üç blokerin heç biri texniki deyil, üçü də
"kim idarə edir" sualına dayanır:

| # | Boşluq | Niyə blokerdir |
|---|--------|----------------|
| **B1** | **Moderasiya aləti yoxdur** | Şikayətlər `reports` cədvəlinə yığılır, onları görən bir nəfər, bir ekran, bir proses yoxdur. App Store istifadəçi kontenti olan tətbiqdən şikayət + blok + **24 saat içində reaksiya** tələb edir (Guideline 1.2). Hazırda cavab verən yoxdur. |
| **B2** | **İstifadəçi profilini redaktə edə bilmir** | Onboarding 3 addımdan 2-yə endirilib (ekran 39 çıxarılıb), "Profili redaktə et" (ekran 54) yazılmayıb. `PATCH /me` API-də var, mobil UI yoxdur → **istifadəçi heç vaxt avatar, bio və ya ad təyin edə bilmir**. Sosial lentin özəyi zədələnir. |
| **B3** | **Tənzimləmələr ekranı yoxdur** (ekran 34) | Dil seçimi, bildiriş tənzimləmələri, məxfilik, **hesabın silinməsi** və **çıxış** buradadır. Hesabın tətbiq içindən silinməsi App Store-un 5.1.1(v) tələbidir — API-də var, ekran yoxdur. |

Bunlardan başqa: PSP seçilməyib (gəlir axını mock-dur), push yoxdur (retention aləti yoxdur),
analitika ümumiyyətlə yoxdur (qərar verəcək data yoxdur).

---

## 2. Ekran əhatəsi — 56 dizayndan 43-ü yazılıb

**Vacib tapıntı:** boşluqların hamısı gələcək sprintlərə aid deyil. **"Tamamlandı" sayılan
sprintlərdən 8 ekran qalıb** — sprint bitmə meyarı dizayn siyahısına görə yoxlanmayıb.

### 2.1 Bitmiş sprintlərdən qalanlar (planlaşdırılmamış borc)

| Ekran | Ad | Hansı sprintə aid idi | Təsir |
|-------|-----|----------------------|-------|
| **54** | Profili redaktə et | Sprint 1 ✅ | **B2** — avatar/bio heç vaxt təyin edilə bilmir |
| **34** | Tənzimləmələr | Sprint 1 ✅ | **B3** — dil, bildiriş, hesab silmə, çıxış |
| **39** | Onboarding 3/3 (foto, bio, icazələr, +100 XP) | Sprint 1 ✅ | Onboarding 2 addıma endirilib; +100 XP mükafatı itib |
| **45** | Filtr paneli | Sprint 2 | Kəşfdə filtr düymələri ölüdür |
| **46** | Fotolar (qalereya) | Sprint 2 | Məkanın bütün fotoları görünmür |
| **47** | Bütün rəylər | Sprint 2 | Yalnız ilk 5 rəy görünür, "hamısı" yolu yoxdur |
| **32** | Regionlar (32/50 kəşf) | Sprint 2 | Gamification-ın ən güclü vizual hissəsi |
| **21** | Local Expert profili | Sprint 3 | Təcrübə detalından expertə keçid yoxdur |
| **25** | Offline xəritələr | Sprint 5 ✅ | Backend manifesti hazırdır, UI yoxdur |

> Ekran 38 (OTP) və 52 (check-in/XP modalı) ayrıca fayl deyil, amma
> `ForgotPasswordScreen` və `CheckinScreen` daxilində örtülüb — bunlar boşluq sayılmır.

### 2.2 Plan üzrə gələcək sprintlərdə

20 (Tədbirlər), 44 (Tədbir detalı) — Sprint 9 · 35 (PRO), 36 (Expert paneli), 55 (Expert ol),
56 (Təcrübə yarat) — Sprint 8.

---

## 3. Backend var, istifadəçi çata bilmir

Yazılmış və test edilmiş, amma mobil tərəfdə düyməsi olmayan funksiyalar:

| Endpoint | Vəziyyət |
|----------|----------|
| `PATCH /me`, `PATCH /me/settings` | UI yoxdur (B2, B3) |
| `DELETE /me` (hesabı sil) | UI yoxdur — mağaza tələbi |
| `POST /users/:username/block` | Profil menyusunda yoxdur |
| `PATCH/DELETE /posts/:id` | Öz paylaşımını redaktə/sil etmək olmur |
| `POST /routes/:slug/copy` | "Marşrutu kopyala" düyməsi yoxdur |
| `GET /places/:slug/photos` | Ekran 46 yoxdur |
| `GET /offline/manifest` | Ekran 25 yoxdur |
| `GET /legal/:slug` | Yalnız başlıq + link qaytarır, **mətn yoxdur** |

**Bu audit zamanı düzəldilənlər:** "Saxla" düyməsi vəziyyətsiz idi (hər toxunuş POST göndərirdi,
ikon dəyişmirdi) — API-yə `isSaved` əlavə olundu, üç detal ekranı bağlandı, kontrakt testi yazıldı.
"Paylaş" düymələri heç nə etmirdi — sistem paylaşma vərəqi qoşuldu.

---

## 4. Rol matrisi — kim nə edə bilir

Sxemdə 4 rol var (`gezgin`, `local_expert`, `business`, `admin`), amma **yalnız birinin axını var**.

| Rol | Sxem | API | Mobil | Boşluq |
|-----|------|-----|-------|--------|
| **gezgin** | ✅ | ✅ | ✅ | — |
| **local_expert** | ✅ | qismən (`experiences` CRUD) | ❌ | Müraciət (55), təsdiq, panel (36), qazanc, ödəniş — heç biri yoxdur. `ExpertApplication` modeli sxemdə var, bir sətir kod ona toxunmur. |
| **business** | ✅ | oxu (`businesses`) | oxu (22) | Biznes özü nə edə bilər? Məkanını idarə etmək, təklif yaratmaq, rezervasiyanı qəbul etmək — yoxdur. |
| **admin** | ✅ | ❌ | — | **Bir dənə də `admin/*` endpoint yoxdur.** `AuditLog` modeli sxemdə var, işlədilmir. |

Yəni platformanın iki tərəfli bazar modeli (gezgin ↔ expert/biznes) hazırda **tək tərəflidir**.

---

## 5. Ölçmə boşluğu

Kod bazasında analitika ilə bağlı **heç nə yoxdur** — nə SDK, nə event, nə funnel.
Buraxılışdan sonra "nə işləyir?" sualına cavab verməyin yolu olmayacaq.

Minimum izlənməli hadisələr: qeydiyyat funneli (splash → register → onboarding → ilk lent),
ilk check-in-ə qədər keçən vaxt, check-in → foto paylaşımı çevrilməsi, rezervasiya funneli
(təcrübə → tarix → ödəniş), D1/D7/D30 qayıdış, axtarış nəticəsizliyi.

Eyni şəkildə **Sentry/Crashlytics də yoxdur** — mobil crash-lar görünməyəcək.

---

## 6. Digər tapıntılar

- **i18n qoşulub, işlədilmir.** `i18next` quraşdırılıb, amma 43 ekrandan yalnız 17 yerdə
  istifadə olunur — qalan mətnlər sərt kodlanıb. Üstəlik `ru` dil kimi qəbul edilir, amma
  `ru.json` resursu yoxdur → rus cihazı azərbaycancaya düşür.
- **Hüquqi mətnlər yoxdur.** `GET /legal/terms` yalnız `https://gezgin.app/legal/terms` linkini
  qaytarır, o səhifə mövcud deyil. Qeydiyyatda "şərtləri qəbul edirəm" var, şərtlər yoxdur.
- **Paylaşılan linklər açılmır.** Paylaşma `https://gezgin.app/m/<slug>` göndərir, amma veb sayt
  və universal link konfiqurasiyası yoxdur — linkə toxunan istifadəçi heç yerə düşmür.
- **Şəkil moderasiyası yoxdur.** İstifadəçi istənilən fotonu yükləyə bilir, avtomatik yoxlama yoxdur.
- **Ödəniş mock-dur.** `MockPaymentProvider` real PSP ilə əvəz olunmalıdır; komissiya 80/20 hesablanır,
  amma expert-ə real ödəniş (payout) axını heç yerdə yoxdur.
- **TECH-PLAN cədvəli köhnəlib** — Sprint 2, 3, 4 kodda bitib, cədvəldə ✅ işarəsi yoxdur.
- **Lint heç vaxt işləməyib.** Hər iki `package.json`-da `lint` skripti var, amma repoda bir dənə də
  `eslint.config.*` faylı yoxdur — əmr işə salınan kimi xəta verir. CI-də də lint addımı yox idi
  (iş adı "lint, typecheck, test" deyirdi, amma yalnız typecheck və test işləyirdi — ad düzəldildi).
  `eslint-plugin-react-hooks` qoşulması tövsiyə olunur: `useEffect` asılılıq səhvləri RN-də
  ən çox təkrarlanan səssiz xətadır.
- **CI mobil tərəfi ümumiyyətlə yoxlamırdı** — bu auditdə `mobile` işi əlavə olundu
  (typecheck + 35 kontrakt testi).

---

## 7. Veb admin panel — cavab

**Hazırda yoxdur.** Nə panel, nə `admin/*` endpoint, nə rol yoxlaması. Planda Sprint 10-a
(20–21-ci həftə) qoyulub — yəni buraxılışdan **iki sprint əvvələ**. Bu ardıcıllıq yanlışdır:
moderasiya buraxılışdan sonra deyil, buraxılışdan **əvvəl** lazımdır.

Hazırda nəzarətin yeganə yolu — bazaya birbaşa müraciət (Prisma Studio / phpMyAdmin).
Bu developer alətidir: audit izi yoxdur, rol məhdudiyyəti yoxdur, səhv bir `UPDATE` bərpa edilə
bilmir, və developer olmayan komanda üzvü istifadə edə bilməz.

### 7.1 Nə lazımdır (minimum → tam)

**Mərhələ A — "Moderasiya minimumu" (~1 həftə, buraxılışdan ƏVVƏL):**

| Modul | Nə edir | Endpoint |
|-------|---------|----------|
| Şikayət növbəsi | Açıq şikayətlər, kontenti gör, sil / rədd et / istifadəçini blokla | `GET /admin/reports`, `POST /admin/reports/:id/resolve` |
| İstifadəçi idarəsi | Axtar, dayandır (`suspended`), bərpa et, sil | `GET /admin/users`, `POST /admin/users/:id/suspend` |
| Kontent sil | Paylaşım, şərh, rəy, hekayə, foto | `DELETE /admin/content/:type/:id` |
| Audit izi | Hər admin əməliyyatı `AuditLog`-a (model artıq sxemdədir) | avtomatik |

**Mərhələ B — Sprint 8–9 ilə paralel:**
kontent CRUD (məkan, marşrut, təcrübə, tədbir, region), expert müraciətlərinin təsdiqi,
biznes hesabların idarəsi, rezervasiya/ödəniş baxışı və geri qaytarma.

**Mərhələ C — buraxılışdan sonra:**
statistika paneli (DAU, funnel, gəlir), toplu bildiriş göndərmə, gamification konfiqurasiyası
(XP qaydaları, level həddi — hazırda kodda sabitdir), seed/import alətləri.

### 7.2 Texniki yanaşma

- **Next.js (App Router) + eyni NestJS API** — ayrıca backend yazılmır, `admin/*` prefiksli
  controller-lər əlavə olunur. Panel `apps/admin` kimi monorepoya girir, dizayn tokenləri
  `@gezgin/shared`-dən gəlir.
- **`RolesGuard`** — mövcud `JwtAuthGuard`-ın üstünə `@Roles('admin')`; admin girişi ayrıca
  2FA ilə (mobil tətbiqdə admin girişi ümumiyyətlə olmamalıdır).
- **Hər dəyişiklik `AuditLog`-a** — kim, nə vaxt, nəyi, hansı dəyərdən hansına.
- **Yumşaq silmə** — admin "sil" düyməsi `deletedAt` qoyur, 30 gün saxlanır, sonra fiziki silinir.

### 7.3 Əməliyyat prosesi (alət qədər vacibdir)

| Hadisə | SLA | Kim |
|--------|-----|-----|
| Şikayət | 24 saat | moderator növbəsi |
| Expert müraciəti | 3 iş günü | məzmun meneceri |
| Ödəniş mübahisəsi | 5 iş günü | maliyyə |
| Kritik kontent (zorakılıq, spam dalğası) | 2 saat | növbətçi |

Buraxılış günü ən azı **bir nəfər** bu növbəyə təyin edilməlidir.

---

## 8. Tövsiyə olunan ardıcıllıq

Mövcud plan Sprint 8 (Expert & PRO) ilə davam edir. Tövsiyəm ardıcıllığı dəyişməkdir:

1. **Sprint 7.5 — "Boşluqları bağla" (1 həftə):** ekran 54, 34, 39 (B2, B3), + 45, 46, 47, 32, 21.
   Bunlar yeni iş deyil, bitmiş sayılan sprintlərin borcudur və hamısının backend-i hazırdır.
2. **Sprint 8 — Admin panel Mərhələ A** (plandakı Sprint 10-dan irəli çəkilir).
3. **Sprint 9 — Expert & PRO** (köhnə Sprint 8) — admin panel olmadan expert təsdiqi onsuz da işləmir.
4. **Sprint 10 — Tədbirlər, push, analitika, Sentry.**
5. **Sprint 11 — PSP inteqrasiyası, hüquqi mətnlər, veb landing + universal linklər, i18n tamamlanması.**
6. **Sprint 12 — Hardening və buraxılış.**

Əsas arqument: 2 və 3-ü yerini dəyişmək bir sprint də əlavə etmir, amma buraxılışın
hüquqi/mağaza riskini aradan qaldırır.

---

## 9. Auditdən sonra icra olunanlar (2026-09-21)

Audit yazıldığı gün planın 1-ci və 2-ci addımı işə salındı.

### Sprint 7.5 — bitmiş sprintlərin borcu

| Ekran | Vəziyyət | Qeyd |
|-------|----------|------|
| **54** Profili redaktə et | ✅ | Cover/avatar yükləmə, ad, username, bio, ev regionu, maraqlar |
| **34** Tənzimləmələr | ✅ | Dil (az/en/ru), bildirişlər, məxfilik, bloklananlar, Wi-Fi, hüquqi, çıxış, **hesabı sil** |
| **39** Onboarding 3/3 | ✅ | Foto, username, bio, yerləşmə icazəsi, +100 XP; "Sonra edərəm" ilə keçilə bilər |
| **45** Filtr paneli | ✅ | Kateqoriya, reytinq, qiymət, məsafə; nəticə sayı seçimlə birlikdə yenilənir |
| **46** Fotolar | ✅ | Rəsmi/icma tabları, tam ekran baxış, "Foto əlavə et" |
| **47** Bütün rəylər | ✅ | Ulduz bölgüsü, 4 sıralama, rəy kartları |
| **32** Regionlar | ✅ | 0/7 tərəqqi, kəşf edilməmiş regionlar solğun |
| **21** Local Expert profili | ✅ | Gezgin profilinə expert bloku: reytinq, ixtisaslar, təcrübələr |
| **25** Offline xəritələr | ⬜ | Sprint 9-a qalır (Mapbox offline paketləri ilə birlikdə) |

**Nəticə:** 56 dizayn ekranından **49-u** yazılıb (38 və 52 ayrıca fayl deyil, `ForgotPassword`
və `Checkin` ekranlarının içindədir). Qalan 7-si plan üzrə növbədədir: **20, 44** (tədbirlər —
Sprint 9), **25** (offline xəritə — Sprint 9), **35, 36, 55, 56** (PRO və Expert — Sprint 8).

### Admin paneli — Mərhələ A (backend)

`admin` modulu: **10 endpoint**, 17 e2e testi, hamısı `@Roles('admin')` arxasında.

| Endpoint | Nə edir |
|----------|---------|
| `GET /admin/stats` | Açıq şikayətlər, **24 saatlıq SLA pozuntusu**, istifadəçi və paylaşım sayğacları |
| `GET /admin/reports` | Moderasiya növbəsi — hər sətirdə kontent önizləməsi və şikayətin yaşı |
| `GET /admin/reports/:id` | Tam kontent, təkrar şikayət sayı, müəllifin keçmişi |
| `POST /admin/reports/:id/resolve` | `dismiss` / `delete_content` / `suspend_user` — eyni kontentə olan digər şikayətlər də bağlanır |
| `GET /admin/users`, `GET /admin/users/:username` | Axtarış və istifadəçi kartı |
| `POST /admin/users/:username/suspend` \| `/restore` | Dayandırma aktiv sessiyaları da bağlayır |
| `DELETE /admin/content/:type/:id` | Paylaşım, şərh, rəy, hekayə — sayğaclar və reytinqlər yenidən hesablanır |
| `GET /admin/audit` | Kim, nə vaxt, nəyi, hansı vəziyyətdən hansına |

**Next.js paneli** (`apps/admin`) da hazırdır: panel, şikayət növbəsi və detalı (üç qərar düyməsi),
istifadəçi axtarışı və dayandırma/bərpa, audit izi. Giriş seed-dəki `admin.demo` hesabı ilə;
token httpOnly cookie-dədir, hər sorğu server tərəfdə gedir.

Qalan iş: Mərhələ B (kontent CRUD, expert müraciətləri, rezervasiya/ödəniş baxışı) və
Mərhələ C (statistika, toplu bildiriş, gamification konfiqurasiyası).

### Yol boyu tapılan və düzəldilən xətalar

- `PATCH /me/settings` mobil tərəfdən `lang` göndərirdi — server `language` gözləyir (400).
- Tənzimləmələrdə açarı yalnız kiçik Switch elementi çevirirdi; indi bütün sətir toxunula bilir
  və ekran oxuyucusu sətri bir element kimi oxuyur.
- `Button` komponenti `accessible` elan etmirdi — VoiceOver "düymə" demirdi.
- Çoxsətirli `Input`-da sabit hündürlük mətni çərçivədən çıxarırdı.
- `ru` dili seçilə bilirdi, amma tərcümə faylı yoxdur — indi dil siyahısı resurslardan çıxarılır.
