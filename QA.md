# GEZGIN — QA təlimatı

Test mühiti: **prod server `13.60.173.66`**. Mobil tətbiq və admin paneli eyni API-yə bağlıdır.
Şifrələr bu faylda yoxdur — onları ayrıca alırsan.

## Ünvanlar və buildlər

| | |
|---|---|
| Admin paneli | `http://13.60.173.66/` |
| API | `http://13.60.173.66/api/v1` · sağlamlıq: `/api/v1/health` |
| Swagger | `http://13.60.173.66/docs` |
| Android | `~/Desktop/GEZGIN-1.0-prod.apk` (arm64 — bütün müasir telefonlar) |
| iOS | `~/Desktop/GEZGIN-1.0-prod-signed.ipa` — yalnız qeydiyyatlı iPhone-da işləyir |

## Test hesabları

| İstifadəçi | Rol | Nəyi test etmək üçün |
|---|---|---|
| `qa.gezgin` | gezgin | Əsas istifadəçi: kəşf, plan, check-in, paylaşım, rezervasiya |
| `qa.expert` | local_expert | Profildə expert bloku, "Local Expert" nişanı |
| `qa.biznes` | business | `gabala-resort-spa` otelinin sahibi |
| `admin.demo` | admin | Yalnız web admin paneli |

Hamısının onboarding-i tamamlanıb — girişdən sonra birbaşa lentə düşürsən. Yeni hesab da
qeydiyyatla yaradıla bilər. Seed istifadəçiləri (`aysel.go`, `tural.travels` və s.) **şifrəsizdir**,
onlarla giriş olmur — onları lentdə, rəylərdə, profillərdə görəcəksən.

## Ödəniş (mock — real pul çıxmır)

| Kart | Nəticə |
|---|---|
| `4111 1111 1111 1111` | uğurlu |
| `4000 0000 0000 0002` | rədd edildi (vəsait yoxdur) |
| `4000 0000 0000 3220` | 3-D Secure → OTP **`123456`** |
| `4000 0000 0000 0069` | müddəti bitmiş kart |

Tarix gələcəkdə, CVC istənilən 3 rəqəm ola bilər. Kart **rezervasiya ekranında "Kart əlavə et"** və ya
**Tənzimləmələr → Ödəniş üsullarım** ilə əlavə olunur. 3-D Secure kartında ödənişdən sonra OTP pəncərəsi açılır.

**Ləğv siyasəti:** başlanğıca ≥48 saat — 100%, 24–48 saat — 50%, <24 saat — geri qaytarma yoxdur.
Ödənilməmiş rezervasiya 30 dəqiqə sonra avtomatik ləğv olunur.

## Test sənədi

Bütün biznes məntiqi testləri, gözlənilən nəticələri və son statusları: **`TEST-CASES.md`**.
API səviyyəli qaydalar avtomatik yoxlanılır: `python3 scripts/qa/api_rules.py` (lokal API + dev baza).

## Nəyi test etmək

**Mobil**

- Qeydiyyat, giriş, qonaq rejimi, çıxış, hesabın silinməsi
- Onboarding: maraqlar → profil qurma (foto, bio, yerləşmə icazəsi)
- Lent: bəyən, şərh, saxla, paylaş, şikayət; hekayələr; izləmə
- Kəşf: yerlər, filtr paneli, xəritə, axtarış, məkan detalı, fotolar, bütün rəylər, rəy yazma
- Marşrutlar və təcrübələr: detal, saxla, plana əlavə et, marşrut qurucu
- Planım: səyahət yarat, gün-gün plan, check-in (məkanda olmaq lazımdır — radius 1 km)
- Rezervasiya: təcrübə və otel, ödəniş (yuxarıdakı kartlar), biletlər, ləğv
- Profil: redaktə (avatar, cover, bio, region, maraqlar), tənzimləmələr, regionlar, nailiyyətlər, liderlər
- Sosial: mesajlar, canlı çat, bildirişlər
- Hər ekranda: boş vəziyyət, yüklənmə, xəta (interneti söndür), uzun mətnlər

**Web admin**

- Giriş: `admin.demo` ilə uğurlu; `qa.gezgin` ilə "panelə girişi yoxdur" xətası
- Panel: rəqəmlər, 24 saatlıq SLA göstəricisi
- Şikayətlər: mobildən paylaşımı şikayət et → növbədə görün → rədd et / kontenti sil / hesabı dayandır
- Dayandırılmış hesab mobildə dərhal çıxarılmalıdır
- İstifadəçilər: axtarış, kart, dayandır / bərpa et
- Audit izi: hər əməliyyat görünməlidir

## Məlum problemlər — xəta kimi yazma

| Problem | Səbəb |
|---|---|
| Sayt və API HTTP ilə işləyir, HTTPS yoxdur | Domen hələ yoxdur |
| E-poçt gəlmir (şifrə bərpası kodu, xoş gəldin məktubu) | Real e-poçt provayderi seçilməyib; məktublar serverdə tutulur |
| iOS tətbiqi **1 oktyabrdan** sonra açılmır | Pulsuz Apple ID ilə imza 7 gün etibarlıdır |
| Paylaşılan linklər (`gezgin.app/…`) açılmır | Veb sayt yoxdur |
| Push bildirişi gəlmir | Sprint 9 |
| Tədbirlər, offline xəritə, PRO, expert paneli, "Local Expert ol", təcrübə yaratma ekranları yoxdur | Plan üzrə Sprint 8–9 |
| Təcrübə tarixləri avtomatik açılır (hər 2 gündən bir, 10:00; gecə turları 19:00) | Expert paneli gələnə qədər `DEMO_SLOTS` |
| Biznes sahibi üçün idarəetmə ekranı yoxdur | Hələ planlaşdırılmayıb |
| İnterfeys yalnız azərbaycancadır; Tənzimləmələr → "Kontent dili" yalnız məkan/marşrut/region adlarını dəyişir | Tam i18n ayrıca işdir |
| Hüquqi sənədlərin mətni hüquqşünas tərəfindən yoxlanılmayıb | Yayımdan əvvəl |
| Hər qonaq girişi serverdə yeni hesab yaradır | Qonaq hesablarının təmizlənməsi hələ yazılmayıb |

## Xətanı necə yazmaq

Hər xəta üçün: **ekran** · **hesab** · **cihaz və OS** · **addımlar** · **gözlənilən / baş verən** ·
ekran şəkli. Mümkünsə vaxtı da qeyd et — server loglarında axtarmaq asanlaşır.
