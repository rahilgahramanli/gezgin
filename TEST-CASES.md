# GEZGIN — Biznes məntiqi test sənədi (mobil)

Məqsəd: mobil tətbiqin bütün biznes məntiqini iPhone simulyatorunda əl ilə (idb toxunuşları ilə)
yoxlamaq, nəticəni API və baza ilə təsdiqləmək. UI-dan çatılmayan qaydalar (limitlər, təhlükəsizlik,
fon prosesləri) API səviyyəsində yoxlanılır.

**Mühit:** iPhone 17 Pro simulyatoru (iOS 26) · Debug build → lokal API `localhost:3100` · MySQL `3310` · MinIO `9010`.
**Test kartları (mock):** `4111 1111 1111 1111` uğurlu · `4000 0000 0000 0002` vəsait yoxdur ·
`4000 0000 0000 3220` 3-D Secure, OTP `123456` · `4000 0000 0000 0069` müddəti bitib.

**Üsul:** `UI` — simulyatorda toxunuşla · `API` — curl ilə · `DB` — nəticə bazada yoxlanılır.
**Status:** ⏳ gözləyir · ✅ keçdi · ❌ xəta tapıldı · 🔧 düzəldildi və təkrar yoxlanıldı · ➖ tətbiq olunmur (plan üzrə sonrakı sprint)

## Biznes qaydalarının xülasəsi (gözlənilən nəticələrin mənbəyi)

| Qayda | Dəyər |
|---|---|
| XP: ilk check-in / rəy / fotolu paylaşım / marşrut / profil / ödəniş / səyahət / təcrübə | 600 / 400 / 300 / 350 / 100 / 50 / 500 / 800 |
| Gündəlik XP limiti: check-in / rəy / paylaşım / marşrut | 3 / 3 / 5 / 2 |
| Level həddləri (ümumi XP) | L2 150 · L3 350 · L4 600 · L5 900 · L6 1300 · L7 1800 · L8 2400 · L9 3100 · L10 3900 … L20 17400 |
| Tier | L1–5 Başlanğıc · L6–12 Kəşf edən · L13–17 Səyyah · L18–19 Kəşfçi · L20 Gezgin |
| Gezgin Score | region×40 + məkan×12 + təcrübə×20 + marşrut×15 + rəy×8 + paylaşım×5 + min(izləyici, 250) |
| Check-in radiusu | 1000 m, yerləşmə məcburi |
| Uşaq qiyməti (təcrübə) | böyük qiymətinin 50%-i; əlavələr nəfər başına |
| Otel paketi | sabit qiymət, əlavələr bir dəfə (spa 60, transfer 25) |
| Ləğv və geri qaytarma | ≥48 saat 100% · 24–48 saat 50% · <24 saat 0% |
| Gəlir bölgüsü | expert 80% · platforma 20% |
| Hekayə ömrü | 24 saat |

---

## 1. Qeydiyyat, giriş, sessiya (AUTH)

| ID | Üsul | Test (addımlar) | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| AUTH-01 | UI | Splash → "Qeydiyyat" → düzgün ad, istifadəçi adı, e-mail, 8+ simvol şifrə → göndər | Hesab yaranır, onboarding "Addım 2 / 3" açılır | ✅ |
| AUTH-02 | UI | Qeydiyyat formunda sahələri bir-bir doldur | Düymə yalnız ad ≥2, ad ≥3, e-mail "@" və şifrə ≥8 olanda aktivdir | ✅ |
| AUTH-03 | UI | Mövcud e-maillə qeydiyyat | E-mail altında "Bu e-mail artıq qeydiyyatdadır" | ✅ |
| AUTH-04 | UI | Mövcud istifadəçi adı ilə qeydiyyat | İstifadəçi adı altında "Bu istifadəçi adı tutulub" | ✅ API: 409 USERNAME_TAKEN, sahə altında göstərilir |
| AUTH-05 | UI | İstifadəçi adına böyük hərf / boşluq / "ə" yaz | Sahə avtomatik `[a-z0-9._]`-a çevrilir, server xətası çıxmır | 🔧 T1: böyük hərf/boşluq qəbul edilir, ümumi "Validasiya xətası" → ad yazılarkən təmizlənir, server mesajı konkret göstərilir |
| AUTH-06 | UI | Səhv e-mail (`a@b`) | "E-mail düzgün deyil" | ✅ "E-mail düzgün deyil" |
| AUTH-07 | UI | İstifadəçi adı + şifrə ilə giriş | Lentə düşür | ✅ |
| AUTH-08 | UI | E-mail (BÖYÜK hərflə) + şifrə ilə giriş | Lentə düşür (e-mail registrdən asılı deyil) | ✅ |
| AUTH-09 | UI | Yanlış şifrə | "E-mail və ya şifrə yanlışdır", giriş olmur | ✅ |
| AUTH-10 | UI | Boş sahələr / şifrə göz ikonu | Düymə deaktiv; göz ikonu şifrəni göstərir/gizlədir | ✅ |
| AUTH-11 | UI | "Şifrəni unutmusan?" → e-mail → kod → yeni şifrə | Dev kodu görünür, şifrə yenilənir, köhnə şifrə ilə giriş olmur, yenisi ilə olur | 🔧 T1: uğur mesajı yox idi → "Şifrə yeniləndi" |
| AUTH-12 | UI | Şifrə bərpasında yanlış kod | "Kod yanlışdır"; 5 yanlışdan sonra "Çox sayda yanlış cəhd" | ✅ |
| AUTH-13 | UI | "Qonaq kimi davam et" | Onboarding-siz lentə düşür, məzmun oxunur | ✅ |
| AUTH-14 | UI | Qonaq: bəyən, saxla, izlə, şərh, paylaşım, səyahət, bron, mesaj, check-in | Hər birində aydın "Hesab lazımdır" mesajı və qeydiyyata keçid; UI yanlış vəziyyətdə qalmır | 🔧 T1: alertdə qeydiyyat yolu yox, izləmə səhv vəziyyətdə qalırdı, Mesaj səssiz, Planım yanıltıcı → "Qeydiyyatdan keç", geri qaytarma, qonaq ekranları, bron ekranında dəvət |
| AUTH-15 | API | Qonaq token-i refresh olunur, sonra `POST /posts` | Yeni token də qonaq kimi qalır → 403 | 🔧 T1: refresh-dən sonra qonaq paylaşım edə bilirdi → 403 |
| AUTH-16 | UI | Profil → Tənzimləmələr → "Çıxış" | Təsdiq soruşulur, sonra Splash; tətbiqi yenidən açanda da Splash | 🔧 T1: təsdiq yox idi → təsdiq alerti |
| AUTH-17 | UI | Girişdən sonra tətbiqi öldür və yenidən aç | Sessiya bərpa olunur, lent açılır | ✅ |
| AUTH-18 | UI | Access token-i korlanmış sessiya ilə tətbiqi aç | Klient səssizcə refresh edir, istifadəçi çıxarılmır | ✅ |
| AUTH-19 | API | Refresh token-i iki dəfə işlət | İkincidə `TOKEN_REUSED`, bütün sessiyalar bağlanır | ✅ |
| AUTH-20 | UI | Tənzimləmələr → "Hesabı sil" → təsdiq | Splash; həmin hesabla giriş olmur; eyni e-maillə yenidən qeydiyyat mümkündür; paylaşımları lentdən itir | ✅ |
| AUTH-21 | API | Girişə dəqiqədə 11 cəhd | 429, tətbiqdə oxunaqlı xəta | ✅ nginx arxasında da istifadəçi başına (trust proxy) |

## 2. Onboarding (ONB)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| ONB-01 | UI | Maraqlar ekranı | Seçim olmayanda "Ən azı 1 maraq seç" deaktiv; seçdikcə "Davam et (N seçildi)" | ✅ |
| ONB-02 | UI+DB | 2 maraq seç → davam et | Maraqlar yazılır, +100 XP (bir dəfəlik) | ✅ |
| ONB-03 | UI | Profil qurma: şəkil seç, bio yaz, yerləşmə icazəsi | Avatar yüklənir, bio sayğacı "n/300", icazədən sonra "Soruşuldu" | 🔧 T1: istifadəçi adında autocorrect ("ui.tester"→"hi.tester") → söndürüldü |
| ONB-04 | UI | "Başlayaq" | Profil yazılır, lent açılır | ✅ |
| ONB-05 | UI | Başqa hesabda "Sonra edərəm" | Lent açılır, onboarding təkrar çıxmır | ✅ |
| ONB-06 | UI | Addım 3-də tətbiqi öldür, yenidən aç | Maraqlar ekranı təkrar çıxmır (server onboarding-i tamamlanmış sayır) | 🔧 T1: maraqlar ekranı təkrar açılırdı → server vəziyyəti yoxlanılır |
| ONB-07 | API | Maraqları ikinci dəfə saxla | XP təkrar verilmir | ✅ |

## 3. Lent və paylaşımlar (FEED)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| FEED-01 | UI | Lent: "Sənin üçün" | Paylaşımlar, hekayə halqaları, "Populyar təcrübələr" zolağı; aşağı sürüşdürdükcə yüklənir; yuxarı çəkəndə yenilənir | ✅ |
| FEED-02 | UI+DB | Paylaşımı bəyən, sonra geri al | Say +1/−1, serverdə uyğun | ✅ |
| FEED-03 | DB | Başqasının paylaşımını bəyən | Müəllifə bildiriş; bəyən→geri al→bəyən 24 saatda 1 bildiriş | ✅ |
| FEED-04 | UI+DB | Şərh yaz; şərhə cavab yaz | Şərh sayı artır; cavab kök şərhin altında görünür | ✅ |
| FEED-05 | UI | Boş və ya yalnız boşluqlu şərh | Göndər deaktiv / xəta; boş şərh yaranmır | ✅ |
| FEED-06 | UI+DB | Öz şərhini (cavabları ilə) sil | Təsdiq, şərh və cavabları silinir, say doğru azalır | ✅ |
| FEED-07 | API | Paylaşım sahibi başqasının şərhini silir; kənar şəxs silməyə çalışır | Sahib silə bilir; kənar şəxs 403 | ✅ |
| FEED-08 | UI | Şərhi bəyən | Ürək dolur, say artır | ✅ |
| FEED-09 | UI | Paylaşımı saxla → Profil → "İstəklərim" | Paylaşım saxlanılanlarda; geri götürəndə itir | ✅ |
| FEED-10 | UI+DB | Paylaş → söhbətə sürətli göndər | "Göndərildi", söhbətdə link mesajı, `shareCount` +1 | ✅ |
| FEED-11 | UI+DB | Başqasının paylaşımını şikayət et (səbəb seç); təkrar et | "Təşəkkürlər"; ikincidə "artıq şikayət etmisiniz"; bazada 1 şikayət | ✅ |
| FEED-12 | UI | Öz paylaşımında menyu | "Şikayət et" yoxdur, "Paylaşımı sil" var → silinir, lentdən və profildən itir | ✅ |
| FEED-13 | UI | "İzlədiklərin" tabı | Yalnız izlənənlərin paylaşımları; heç kimi izləmirsənsə boş vəziyyət | ✅ |
| FEED-14 | UI | "Yaxınlıqda" tabı (simulyator yeri Bakı) | İcazə soruşulur; 50 km daxilindəki paylaşımlar və ya "Bu ətrafda sakitlikdir" | ✅ |
| FEED-15 | API | "İzləyicilər" və "Yalnız mən" görünürlüklü paylaşımlar | İzləməyən görmür (404); "Yalnız mən" yalnız müəllifə görünür | ✅ |
| FEED-16 | UI+DB | Mətnli paylaşım (fotosuz) | Yaranır, XP verilmir | ✅ |
| FEED-17 | UI+DB | 2 fotolu paylaşım + #heşteq + məkan | Fotolar MinIO-da, +300 XP alert, heşteqlər yaşıl, məkan etiketi → məkan detalı | ✅ |
| FEED-18 | UI | Paylaşım yarat: boş forma | "Paylaş" deaktiv | ✅ |
| FEED-19 | API | Gündə 6-cı fotolu paylaşım | XP 0, "Gündəlik limit dolub" | ✅ |
| FEED-20 | UI | Level həddini keçən XP | "Level N-ə yüksəldin!" mesajı, sistem bildirişi | ✅ |

## 4. Hekayələr (STORY)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| STORY-01 | UI | "Sən" halqası → 1 foto → Paylaş | Hekayə yaranır, "Sən" halqası aktivləşir | 🔧 T1: uğur mesajı yox idi → "Hekayə paylaşıldı" |
| STORY-02 | UI+DB | Başqasının hekayəsinə bax | 5 san. sonra növbətiyə keçir, sol/sağ toxunuş işləyir, halqa "baxılmış" olur, baxış sayılır | ✅ |
| STORY-03 | UI | Öz hekayəmə bax | Baxış sayı görünür; hekayəni silmək mümkündür | 🔧 T1: öz hekayəni silmək mümkün deyildi → "Hekayəni sil" |
| STORY-04 | API | 24 saatdan köhnə hekayə | Görünmür | ✅ |
| STORY-05 | API | Qapalı hesabın hekayəsi izləməyənə | Görünmür | 🔧 T1: qapalı hesabın hekayəsinə baxış yazılırdı (view) → 404 |

## 5. İstifadəçilər, izləmə, bloklama (USER)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| USER-01 | UI | Paylaşımda müəllifə toxun | Profil: statistika, score, tablar (paylaşımlar, marşrutlar, nailiyyətlər) | ✅ |
| USER-02 | UI+DB | İzlə → izləmədən çıx | Düymə və izləyici sayı dəyişir, serverdə uyğun; müəllifə bildiriş | ✅ |
| USER-03 | UI | Öz profilim | "İzlə" və "Mesaj" düymələri yoxdur | ✅ |
| USER-04 | UI | Qapalı hesabın profili | "Bu hesab qapalıdır"; izlədikdən sonra paylaşımlar görünür | ✅ |
| USER-05 | UI | İzləyicilər / İzləyir siyahıları, tövsiyə olunanlar | Saylar doğru; öz siyahımda tövsiyələr, izlə düyməsi işləyir | 🔧 T2: tövsiyədən izləyəndə "İzləyir N" və siyahı yenilənmirdi → yenilənir |
| USER-06 | UI+DB | Profil menyusu → "Blokla" | Qarşılıqlı izləmələr silinir; onun paylaşımları görünmür; Tənzimləmələrdə bloklanmışlar siyahısında | 🔧 T1: bloklama UI yox idi → profil menyusu "Blokla" |
| USER-07 | UI | Bloklanmışlar → "Bloku götür" | Siyahıdan çıxır, profil yenidən açılır | ✅ |
| USER-08 | UI+DB | Profil menyusu → "Şikayət et" | Şikayət yazılır | 🔧 T1: istifadəçini şikayət UI yox idi → "Şikayət et" |
| USER-09 | API | Özünü izlə / özünü blokla | 400 | ✅ |

## 6. Mesajlar və bildirişlər (CHAT, NOTIF)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| CHAT-01 | UI+DB | Profildən "Mesaj" → mətn göndər | Söhbət açılır, mesaj görünür, qarşı tərəfdə oxunmamış 1 | ✅ |
| CHAT-02 | UI | Qarşı tərəf (API ilə) yazır | Mesaj canlı gəlir, siyahıda nişan, açanda oxunur | ✅ |
| CHAT-03 | UI | Filtr: Hamısı / Local Expert / Biznes / Gezginlər | Siyahı rola görə süzülür | ✅ |
| CHAT-04 | UI | Boş mesaj | Göndər deaktiv | ✅ |
| CHAT-05 | UI | Bloklanmış istifadəçiyə yazmaq | "Bu istifadəçi ilə yazışma mümkün deyil" | ✅ API: blokda 403/404 |
| CHAT-06 | UI | Söhbətdə təcrübə kartı → "Bron et" | Bron ekranı açılır | ➖ Kartı yalnız expert göndərir (expert paneli Sprint 8–9); API kart tipləri yoxlanılıb |
| CHAT-07 | UI | API işləməyəndə mesaj göndər | Xəta göstərilir, mətn itmir | 🔧 T1: xəta səssiz idi → alert, mətn itmir |
| NOTIF-01 | UI | Bəyənmə/şərh/izləmə bildirişi gəlir | Zəngdə nöqtə; siyahıda görünür | ✅ |
| NOTIF-02 | UI+DB | Bildirişə toxun | Oxunmuş olur, uyğun ekran açılır (paylaşım/profil/nailiyyət) | ✅ |
| NOTIF-03 | UI | "Hamısını oxu" | Hamısı oxunur, nöqtə itir | ✅ |
| NOTIF-04 | UI | Tablar Sosial / Sistem | Level və badge bildirişləri "Sistem"də | ✅ |

## 7. Kəşf, axtarış, xəritə, məkan (EXP)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| EXP-01 | UI | Kəşf tabı, region çipləri | Bölmələr yüklənir, region seçəndə üç bölmə süzülür | 🔧 T1: boş bölmələr başlıqla qalırdı; oflayn səssiz boş → boş mətn, xəta kartı, yuxarı çəkib yeniləmə |
| EXP-02 | UI | Axtarış: 1 hərf; "xinaliq" (ə/ı-sız); mövcud olmayan söz | İpucu; "Xınalıq" tapılır; "Nəticə tapılmadı" | ✅ |
| EXP-03 | UI | Axtarış nəticəsinin hər növünə toxun (məkan, marşrut, təcrübə, gezgin) | Hər biri öz detal ekranını açır | 🔧 T1: gezgin nəticəsi heç nə etmirdi → profil açılır; bloklananlar axtarışda görünmür |
| EXP-04 | UI | Məkanlar: region + sıralama | Siyahı dəyişir, "Pulsuz" etiketi giriş haqqı 0 olanlarda | ✅ |
| EXP-05 | UI | Filtr paneli: kateqoriya, reytinq, giriş haqqı, məsafə → göstər; "Sıfırla" | Düymədəki say siyahıdakı sayla eynidir; "Filtr (N aktiv)"; sıfırlama işləyir | 🔧 T1: "göstər" stekə yeni ekran əlavə edirdi → popTo |
| EXP-06 | UI | Xəritə: region, klaster, pin → kart → detal | Kamera region üzərinə gedir; klaster yaxınlaşdırır; kart məkanı açır | 🔧 T1: tək məkanlı klaster kart açmırdı → pin kimi, kart açılır |
| EXP-07 | UI | Məkan detalı | Faktlar, reytinq, rəylər, yaxınlıqdakılar, "Plana əlavə et", "Check-in et" | 🔧 T1: Check-in düyməsi yox, yuxarı panel sürüşüb itirdi → Check-in et, sabit panel |
| EXP-08 | UI+DB | Məkanı saxla / götür | İkon dəyişir, "İstəklərim"də görünür, serverdə uyğun | ✅ |
| EXP-09 | UI | Fotolar → Rəsmi / Gezginlərdən → tam ekran | Süzgəc işləyir, sayğac "i / N" | 🔧 T2: "Gezginlərdən" paylaşım fotolarını göstərmirdi (0), say uyğunsuz → ictimai paylaşım fotoları daxil |
| EXP-10 | UI | Otellər: Kəşf → otel → biznes profili | Paketlər, zəng/vebsayt, "Rezervasiya" | 🔧 T1: otellər heç bir ekrandan açılmırdı → Kəşf-də "Otellər və qonaq evləri" |

## 8. Rəylər (REV)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| REV-01 | UI | Rəy yaz: ulduz seçmədən | Göndər deaktiv | ✅ |
| REV-02 | UI+DB | 4★ + teq + mətn + foto (fotonu sil, yenisini əlavə et) → göndər | "+400 XP", rəy siyahıda; məkanın reytinqi və rəy sayı yenilənir | 🔧 T1: foto silinmirdi, level artımı deyilmirdi → düzəldi |
| REV-03 | UI | Eyni məkana ikinci rəy | Redaktə rejimi, "Rəyi yenilə", XP verilmir, reytinq yenidən hesablanır | 🔧 T1: redaktə formu boş açılır, teqlər silinirdi → mövcud rəylə doldurulur |
| REV-04 | UI | Bütün rəylər: sıralama (yeni, yüksək, aşağı, faydalı), paylanma | Sıralama doğru; faizlər cəmi ~100% | ✅ |
| REV-05 | UI+DB | "Faydalı" işarələ | Say artır, təkrar toxunuş geri alır | 🔧 T2: "faydalı" düyməsi yox idi → hər rəydə "Faydalı · N" |
| REV-06 | API | Gündə 4-cü rəy | XP 0, limit qeydi | ✅ |
| REV-07 | UI | Təcrübə və marşrut detalında reytinq və rəylər | Görünür, rəy yazmaq mümkündür | 🔧 T1: təcrübə/marşrutda rəy yox idi → rəy bloku |
| REV-08 | API | `rating=4` süzgəci | 4 və yuxarı (minimum kimi) | 🔧 T1: dəqiq bərabərlik idi → minimum |

## 9. Marşrutlar (ROUTE)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| ROUTE-01 | UI | Marşrutlar: müddət çipləri; detal | Süzülür; günlər, dayanacaqlar, məsafə/müddət/məkan sayı; dayanacaq → məkan | ✅ |
| ROUTE-02 | UI | Marşrutu saxla | "İstəklərim → Marşrutlar"da görünür | ✅ |
| ROUTE-03 | UI | Marşrut qur: ad <3, region seçilməyib | Yarat düyməsi deaktiv | ✅ |
| ROUTE-04 | UI+DB | 2 günlük marşrut yarat | +350 XP, redaktor açılır, marşrut defolt olaraq qapalıdır | ✅ T2: +350 XP alerti əlavə olundu |
| ROUTE-05 | UI | Dayanacaq əlavə et (region məkanları, axtarış) | Yalnız məkanlar çıxır; eyni gündə təkrar məkan ✓ ilə deaktiv | 🔧 T1: axtarışa marşrut/təcrübə də düşürdü (type≠types) → yalnız məkan |
| ROUTE-06 | UI+DB | Sırala ▲▼, sil, "+ Gün", "İctimai paylaş" | Serverdə sıra, gün sayı və görünürlük uyğun | ✅ |
| ROUTE-07 | UI | Öz marşrutumu sonradan redaktə etmək (detaldan) | Redaktor açılır | 🔧 T1: sonradan redaktə mümkün deyildi → "Redaktə et", "Marşrutu sil" |
| ROUTE-08 | API | Qapalı marşrutu başqası açır / plana idxal edir / saxlayır | 404 | 🔧 T1: başqasının qapalı marşrutu plana idxal/saxlanırdı → 404 |
| ROUTE-09 | API | 2 günlük marşruta 3-cü gün dayanacağı (yaratma, yeniləmə) | 400 | 🔧 T1: yeniləmədə gün yoxlanılmırdı → 400 |
| ROUTE-10 | API | Gündə 3-cü marşrut | XP 0 | ✅ |

## 10. Təcrübələr (XPR)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| XPR-01 | UI | Təcrübələr: kateqoriya çipləri | Süzülür | ✅ |
| XPR-02 | UI | Təcrübə detalı | Qiymət "nəfər başına", daxildir, expert, növbəti tarix və qalan yer, 80/20 kartı | 🔧 T1: növbəti tarix UTC, saatsız → Bakı vaxtı |
| XPR-03 | UI | Saxla (ürək) | "İstəklərim → Təcrübələr"də görünür | ✅ |
| XPR-04 | UI | Təcrübəni plana əlavə et | Seçilmiş səyahət gününə düşür | 🔧 T1: təcrübəni plana əlavə etmək olmurdu → düzəldi |

## 11. Planım / səyahətlər (TRIP)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| TRIP-01 | UI | Yeni səyahət: ad boş → deaktiv; ad + tarix (+7) + 3 nəfər + sıfırdan | Səyahət yaranır, detal açılır, status "Planlanıb" | 🔧 T1: 00:00–04:00 arası bir gün geri (UTC) → yerli tarix |
| TRIP-02 | UI+DB | Marşrut detalı → "Marşrutu başlat" | Səyahət marşrutun günləri və dayanacaqları ilə yaranır | ✅ |
| TRIP-03 | UI | Məkan → "Plana əlavə et" → səyahət + gün | Element seçilmiş gündə | ✅ |
| TRIP-04 | UI+DB | Elementi tamamlandı işarələ | Proqres faizi yenilənir | ✅ |
| TRIP-05 | UI | "Səyahəti başlat" | Status "Aktiv"; başqa aktiv səyahət varsa o "Planlanıb"a qayıdır | ✅ |
| TRIP-06 | UI+DB | "Səyahəti tamamla" | Status "Tamamlandı", +500 XP (yalnız ilk dəfə) | 🔧 T1: tamamlamaq üçün UI yox idi → "Səyahəti tamamla" +500 XP |
| TRIP-07 | UI | Səyahəti sil | Siyahıdan itir | 🔧 T1: silmək üçün UI yox idi → "Səyahəti sil" |
| TRIP-08 | UI | Səyahət siyahısı | Status, tarix, gün/nəfər, proqres doğru | ✅ |
| TRIP-09 | API | Bitmə tarixi başlanğıcdan əvvəl | 400 | ✅ |

## 12. Check-in (CHK)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| CHK-01 | UI+DB | Simulyator yeri = İçərişəhər → məkan → "Check-in et" | Uğur: "İlk ziyarət", +600 XP, score, "İlk addım" badge, level proqresi | ✅ |
| CHK-02 | UI | Yer = Bakı, məkan = Xınalıq | "Check-in üçün məkana 1000 m-dən yaxın olmalısınız (hazırda X km)" | ✅ |
| CHK-03 | UI | Yerləşmə icazəsi rədd edilib | Check-in olmur, icazə tələb edən xəta | 🔧 T1: koordinatsız check-in qəbul olunurdu → API tələb edir, tətbiq izah edir |
| CHK-04 | UI+DB | Eyni məkanda eyni gün təkrar check-in | Qəbul edilmir və ya XP-siz; sayğac şişmir | 🔧 T1: təkrar check-in sayğacı şişirdirdi → gündə 1, 409 mesajı |
| CHK-05 | API | Gündə 4-cü yeni məkan | XP 0, "gündəlik limit" qeydi | ✅ |
| CHK-06 | UI | Səyahət elementindən check-in | Element tamamlanır, səyahət proqresi kartı | 🔧 T1: sessiyada 2-ci check-in sonsuz ilişirdi, səyahət detalı yenilənmirdi → düzəldi |
| CHK-07 | UI | "Yarat" → "Check-in et" | Check-in üçün məkan seçimi açılır | 🔧 T1: Yarat→Check-in axtarışa aparırdı → yaxın məkanlar siyahısı |
| CHK-08 | UI | Regionlar ekranı | Check-in-dən sonra region faizi artır | ✅ |

## 13. Rezervasiya və ödəniş (BOOK)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| BOOK-01 | UI | Təcrübə → "Bron et": tarix seçimi | Slotlar, dolu slot deaktiv; tarix yoxdursa aydın mesaj | 🔧 T1: slotlarda saat yox idi → tarix+saat, seçim, yer limiti |
| BOOK-02 | UI | 2 böyük + 1 uşaq (60 AZN) | 120 + 30 = 150 AZN; böyük min 1 | ✅ |
| BOOK-03 | UI | Kart əlavə et: səhv nömrə / ay / CVC | Validasiya xətaları; düzgün kart saxlanılır, defolt olur | 🔧 T1: kart formu yox idi, 4111 səssiz əlavə olunurdu → kart formu, validasiya |
| BOOK-04 | UI+DB | `4111…` ilə ödə | "Rezervasiya təsdiqləndi!", GZ- kodlu bilet, +50 XP, slotda yer azalır | 🔧 T1: bilet UTC vaxtı göstərirdi → Bakı vaxtı |
| BOOK-05 | UI+DB | `4000…0002` ilə ödə, sonra `4111…` ilə təkrar | "Kartda kifayət qədər vəsait yoxdur"; ikinci cəhd **eyni** rezervasiyanı ödəyir (dublikat yoxdur) | 🔧 T1: xəta panel arxasında görünmürdü, hər cəhd yeni bron yaradırdı → eyni bron, görünən xəta |
| BOOK-06 | UI | `4000…3220`: yanlış OTP, sonra `123456` | OTP ekranı; yanlışda xəta; düzgündə təsdiq | 🔧 T1: 3-D Secure ekranı yox idi → OTP pəncərəsi |
| BOOK-07 | UI | `4000…0069` | "Kartın müddəti bitib" | ✅ API + eyni xəta göstərmə yolu |
| BOOK-08 | UI | Qalan yerdən çox nəfər | "Bu tarixdə yalnız N yer qalıb" | 🔧 T1: mesaj görünmürdü → görünür, stepper-lər yer sayına bağlı |
| BOOK-09 | UI | Rezervasiyalarım: tablar, karta toxun | Gələcək/Keçmiş/Ləğv; detal və bilet açılır | 🔧 T1: kart toxunulmaz idi → Rezervasiya detalı, bilet |
| BOOK-10 | UI+DB | ≥48 saat qalmış rezervasiyanı ləğv et | Geri qaytarma siyasəti göstərilir, 100% qaytarılır, status "Ləğv edilib", yer boşalır | 🔧 T1: ləğv UI yox idi → siyasət + geri qaytarma məbləği; XP və komissiya geri alınır |
| BOOK-11 | API | 24–48 saat / <24 saat ləğv | 50% / 0% | ✅ |
| BOOK-12 | UI+DB | Otel paketi: 2 gecə, spa → ödə | 240 + 60 = 300 AZN, çıxış = giriş + 2 gecə, təsdiq | 🔧 T1: otel ekranına keçid yox idi → Kəşf→Otel→Rezervasiya; 240+60+25=325 |
| BOOK-13 | API | Ödənilməmiş rezervasiya 30 dəqiqədən sonra | Avtomatik ləğv, yer boşalır | 🔧 T1: ödənilməmiş bron yeri əbədi tuturdu → 30 dəq sonra ləğv |
| BOOK-14 | API | Ləğv / geri qaytarılmış rezervasiyanı ödə | 400 | 🔧 T1: geri qaytarılmış bron təkrar ödənirdi → 400 |
| BOOK-15 | API | Başqasının ödənişini geri qaytarmaq (`/payments/:id/refund`) | 403 | 🔧 T1: HƏR KƏS istənilən ödənişi geri qaytara bilirdi → yalnız admin |
| BOOK-16 | API | Başqa istifadəçinin Idempotency-Key-i ilə rezervasiya | Öz yeni rezervasiyası yaranır (açar istifadəçiyə aiddir) | 🔧 T1: açar qlobal idi → istifadəçi üzrə |
| BOOK-17 | API | Keçmiş tarixə rezervasiya / keçmiş rezervasiyanı ödə | 400 | 🔧 T1: keçmiş bron ödənirdi → 400 |
| BOOK-18 | API | Slotsuz (`startAt`) təcrübə bronunda qrup həddi | maxGroup-dan çox → 400 | 🔧 T1: slotsuz bronda tutum yoxlanılmırdı → maxGroup |
| BOOK-19 | API+DB | Bitmiş təsdiqlənmiş təcrübə | "Tamamlandı", +800 XP, statistikada "Təcrübələr" +1 | 🔧 T1: bron heç vaxt "Tamamlandı" olmurdu, 800 XP verilmirdi → həyat dövrü xidməti |
| BOOK-20 | UI | Kartlarım: sil, defolt et | Defolt silinəndə növbəti kart defolt olur | 🔧 T1: kart idarəetməsi yox idi → "Ödəniş üsullarım" |

## 14. Profil, tənzimləmələr, oyunlaşdırma (PROF)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| PROF-01 | UI | Profil tabı | Level, tier, XP, score, statistika — hamısı azərbaycanca; rəqəmlər bazaya uyğun | 🔧 T1: statistika etiketləri ingiliscə → azərbaycanca, toxunulan; bio göstərilir |
| PROF-02 | UI+DB | Redaktə: avatar, cover, ad, istifadəçi adı, bio, ev regionu (seç və götür), maraqlar | Hamısı saxlanılır; region götürüləndə serverdə də silinir | 🔧 T1: KRİTİK — region seçiləndə profil saxlanmırdı (homeRegion≠homeRegionSlug); null 500 verirdi → düzəldi |
| PROF-03 | UI | Redaktə: ad 1 hərf; bütün maraqları götür | "Ad qısadır"; maraqsız saxlamaq olmur (aydın mesaj) | ✅ |
| PROF-04 | UI | Tənzimləmələr → Dil: English | Kontent (məkan adları və s.) ingiliscə gəlir; seçim yadda qalır | 🔧 T1: dil seçimi heç nəyi dəyişmirdi → kontent seçilmiş dildə, yadda qalır ("Kontent dili") |
| PROF-05 | UI+DB | Bildiriş açarları | Serverdə saxlanılır, yenidən açanda qalır | ✅ |
| PROF-06 | UI+API | Məxfilik → "İzləyicilər" | Profil başqaları üçün qapalı olur | 🔧 T1: "İzləyicilər" seçimi profili qapatmırdı → isPublic ilə sinxron |
| PROF-07 | UI | Hüquqi sənədlər | Açılır və ya aydın mesaj | 🔧 T1: mövcud olmayan sayta aparırdı → tətbiqdaxili sənəd + HTML səhifə |
| PROF-08 | UI | Regionlar | "d / t region", faiz check-in-lərə uyğun; regiona toxunuş məkanları açır | ✅ |
| PROF-09 | UI | İstəklərim (saxlanılanlar) | Növ çipləri, saylar, hər elementə toxunuş detala aparır | 🔧 T1: "Want to go", paylaşım "post" və toxunulmaz → "İstəklərim", Paylaşımlar/Otellər açılır |
| PROF-10 | UI | Gezgin Score ekranı | Score formulaya uyğun; qazanma yollarındakı XP qaydalar cədvəlinə uyğun | ✅ |
| PROF-11 | UI | Nailiyyətlər | Qazanılan/kilidli, proqres "x / y" doğru | 🔧 T1: "Region Kəşfçisi" 10 region istəyirdi (7 var), "Fotoqu" mətnləri sayırdı → 5 region, yalnız fotolu |
| PROF-12 | UI | Liderlər: həftəlik / aylıq / bütün zamanlar | Sıralama xala görə; "Sən" sətri | 🔧 T1: "Bütün zamanlar"da score "XP" yazılırdı; filtrlə sıra səhv → "xal", filtrli sıra |
| PROF-13 | API | `/me/stats.score` = `/me` score; `/xp-rules` XP qaydalarını qaytarır | Uyğundur | 🔧 T1: /xp-rules level siyahısı qaytarırdı → XP qaydaları |

## 15. Moderasiya (mobilə təsiri) (MOD)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| MOD-01 | UI+API | Mobildən şikayət → admin növbəsi | Şikayət admin `/admin/reports`-da | ✅ |
| MOD-02 | API+UI | Admin kontenti silir | Paylaşım mobil lentdən itir | ✅ |
| MOD-03 | API+UI | Admin istifadəçini dayandırır | Mobil sessiya növbəti sorğuda bağlanır; girişdə "Hesab dayandırılıb"; bərpadan sonra giriş olur | 🔧 T1: şikayətdən dayandırmada tokenlər ləğv olunmurdu; tətbiq səbəb göstərmirdi → "Hesab aktiv deyil" |
| MOD-04 | API | Adi istifadəçi admin endpoint-inə | 403 | ✅ |

## 16. Ümumi keyfiyyət (X)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| X-01 | UI | API dayandırılıb: lent, məkan detalı, profil, bron | Çökmə yoxdur; ağ ekran yox — xəta mesajı və "Yenidən cəhd et"/"Geri" | 🔧 T1: ağ ekran, Geri yox, istifadəçi ilişirdi → ErrorState (səbəb, Yenidən cəhd et, Geri); oflayn refresh sessiyanı silmir |
| X-02 | UI | API geri gəlir | "Yenidən cəhd et" ilə bərpa | ✅ |
| X-03 | UI | Uzun ad / bio / paylaşım mətni | Layout sınmır | ✅ uzun mətn "…" ilə, bio 3 sətir |
| X-04 | UI | Bütün ekranlarda "Geri" | Hər ekrandan geri çıxmaq olur | ✅ bütün yüklənmə/xəta ekranlarında Geri |
| X-05 | UI | Azərbaycan interfeysində ingiliscə etiket | Yoxdur | 🔧 T1: "Regions/Places/Want to go" → azərbaycanca |

---

## Test turları

| Tur | Tarix | Nəticə |
|---|---|---|
| 1 | 2026-09-28 | UI: 97 qeyd, ~50 xəta. API skripti (`scripts/qa/api_rules.py`): 31/44 → 17 biznes məntiqi xətası |
| 2 (reqressiya) | 2026-09-28 | Bütün 🔧 testlər simulyatorda təkrar keçirildi. API skripti **72/72**, API jest **269/269**, mobil jest **65/65**, köhnə UI smoke axınları (`apps/mobile/e2e/smoke.py`) **13/13**. 2-ci turda əlavə 4 xəta tapılıb düzəldildi (USER-05, EXP-09, REV-05, marşrut XP alerti) |

## Tapılan xətalar — kateqoriyalar üzrə

| Sahə | Əsas xətalar (hamısı düzəldilib) |
|---|---|
| Təhlükəsizlik | istənilən istifadəçi istənilən ödənişi geri qaytara bilirdi (BOOK-15); qonaq token yeniləndikdən sonra məhdudiyyətsiz qalırdı (AUTH-15); nginx arxasında giriş limiti bütün istifadəçilər üçün ortaq idi (AUTH-21); Idempotency-Key istifadəçilər arasında paylaşılırdı (BOOK-16); başqasının qapalı marşrutu idxal olunurdu (ROUTE-08) |
| Pul / rezervasiya | kart formu və 3-D Secure yox idi, test kartı səssiz əlavə olunurdu; rədd edilən ödənişdə hər cəhd yeni bron; xəta görünmürdü; ləğv yox idi; ödənilməmiş bron yeri əbədi tuturdu; geri qaytarılmış bron təkrar ödənirdi; bron heç vaxt tamamlanmırdı (800 XP verilmirdi); vaxtlar UTC ilə |
| Oyunlaşdırma | yerləşməsiz check-in; təkrar check-in spam; sessiyada 2-ci check-in ilişirdi; "Region Kəşfçisi" qazanılmaz idi; /xp-rules səhv idi; leaderboard vahidi və filtrli sıra |
| Profil / məxfilik | region seçimi profili saxlamırdı (KRİTİK); "İzləyicilər" məxfiliyi işləmirdi; dil seçimi heç nə etmirdi; hüquqi sənədlər açılmırdı |
| Sessiya | vaxtı keçmiş token public endpoint-lərdə anonim kimi işləyirdi (15 dəq-dən bir "bəyəndim/saxlanılıb" itirdi); oflayn refresh istifadəçini çıxarırdı; dayandırılmış hesab səbəbsiz çıxarılırdı |
| UX / naviqasiya | xəta halında ağ ekran və çıxış yolu yox; filtr stek sızması; axtarışda gezgin/İstəklərimdə paylaşım toxunulmaz; otellər əlçatmaz; ingiliscə etiketlər; səyahəti tamamla/sil, marşrutu redaktə et, bloklama, istifadəçi şikayəti, hekayə silmə, rəy "faydalı" üçün UI yox idi |

## Məlum məhdudiyyətlər (xəta deyil, plan üzrə)

- Tətbiqin interfeysi yalnız azərbaycancadır; "Kontent dili" məkan/marşrut/region adlarını dəyişir (tam i18n — ayrıca iş).
- Təcrübə tarixlərini expert paneli yarada bilmir (Sprint 8–9) — demo mühitdə `DEMO_SLOTS=true` hər təcrübəyə 30 günlük tarix açır.
- Ödəniş mock provayderdir (real PSP Sprint 11); push bildirişi, tədbirlər, oflayn xəritə — QA.md-dəki siyahı.
- Hüquqi sənədlərin mətni platformanın faktiki qaydalarına əsasən yazılıb — yayımdan əvvəl hüquqşünas yoxlamalıdır.
