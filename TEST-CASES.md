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
| AUTH-01 | UI | Splash → "Qeydiyyat" → düzgün ad, istifadəçi adı, e-mail, 8+ simvol şifrə → göndər | Hesab yaranır, onboarding "Addım 2 / 3" açılır | ⏳ |
| AUTH-02 | UI | Qeydiyyat formunda sahələri bir-bir doldur | Düymə yalnız ad ≥2, ad ≥3, e-mail "@" və şifrə ≥8 olanda aktivdir | ⏳ |
| AUTH-03 | UI | Mövcud e-maillə qeydiyyat | E-mail altında "Bu e-mail artıq qeydiyyatdadır" | ⏳ |
| AUTH-04 | UI | Mövcud istifadəçi adı ilə qeydiyyat | İstifadəçi adı altında "Bu istifadəçi adı tutulub" | ⏳ |
| AUTH-05 | UI | İstifadəçi adına böyük hərf / boşluq / "ə" yaz | Sahə avtomatik `[a-z0-9._]`-a çevrilir, server xətası çıxmır | ⏳ |
| AUTH-06 | UI | Səhv e-mail (`a@b`) | "E-mail düzgün deyil" | ⏳ |
| AUTH-07 | UI | İstifadəçi adı + şifrə ilə giriş | Lentə düşür | ⏳ |
| AUTH-08 | UI | E-mail (BÖYÜK hərflə) + şifrə ilə giriş | Lentə düşür (e-mail registrdən asılı deyil) | ⏳ |
| AUTH-09 | UI | Yanlış şifrə | "E-mail və ya şifrə yanlışdır", giriş olmur | ⏳ |
| AUTH-10 | UI | Boş sahələr / şifrə göz ikonu | Düymə deaktiv; göz ikonu şifrəni göstərir/gizlədir | ⏳ |
| AUTH-11 | UI | "Şifrəni unutmusan?" → e-mail → kod → yeni şifrə | Dev kodu görünür, şifrə yenilənir, köhnə şifrə ilə giriş olmur, yenisi ilə olur | ⏳ |
| AUTH-12 | UI | Şifrə bərpasında yanlış kod | "Kod yanlışdır"; 5 yanlışdan sonra "Çox sayda yanlış cəhd" | ⏳ |
| AUTH-13 | UI | "Qonaq kimi davam et" | Onboarding-siz lentə düşür, məzmun oxunur | ⏳ |
| AUTH-14 | UI | Qonaq: bəyən, saxla, izlə, şərh, paylaşım, səyahət, bron, mesaj, check-in | Hər birində aydın "Hesab lazımdır" mesajı və qeydiyyata keçid; UI yanlış vəziyyətdə qalmır | ⏳ |
| AUTH-15 | API | Qonaq token-i refresh olunur, sonra `POST /posts` | Yeni token də qonaq kimi qalır → 403 | ⏳ |
| AUTH-16 | UI | Profil → Tənzimləmələr → "Çıxış" | Təsdiq soruşulur, sonra Splash; tətbiqi yenidən açanda da Splash | ⏳ |
| AUTH-17 | UI | Girişdən sonra tətbiqi öldür və yenidən aç | Sessiya bərpa olunur, lent açılır | ⏳ |
| AUTH-18 | UI | Access token-i korlanmış sessiya ilə tətbiqi aç | Klient səssizcə refresh edir, istifadəçi çıxarılmır | ⏳ |
| AUTH-19 | API | Refresh token-i iki dəfə işlət | İkincidə `TOKEN_REUSED`, bütün sessiyalar bağlanır | ⏳ |
| AUTH-20 | UI | Tənzimləmələr → "Hesabı sil" → təsdiq | Splash; həmin hesabla giriş olmur; eyni e-maillə yenidən qeydiyyat mümkündür; paylaşımları lentdən itir | ⏳ |
| AUTH-21 | API | Girişə dəqiqədə 11 cəhd | 429, tətbiqdə oxunaqlı xəta | ⏳ |

## 2. Onboarding (ONB)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| ONB-01 | UI | Maraqlar ekranı | Seçim olmayanda "Ən azı 1 maraq seç" deaktiv; seçdikcə "Davam et (N seçildi)" | ⏳ |
| ONB-02 | UI+DB | 2 maraq seç → davam et | Maraqlar yazılır, +100 XP (bir dəfəlik) | ⏳ |
| ONB-03 | UI | Profil qurma: şəkil seç, bio yaz, yerləşmə icazəsi | Avatar yüklənir, bio sayğacı "n/300", icazədən sonra "Soruşuldu" | ⏳ |
| ONB-04 | UI | "Başlayaq" | Profil yazılır, lent açılır | ⏳ |
| ONB-05 | UI | Başqa hesabda "Sonra edərəm" | Lent açılır, onboarding təkrar çıxmır | ⏳ |
| ONB-06 | UI | Addım 3-də tətbiqi öldür, yenidən aç | Maraqlar ekranı təkrar çıxmır (server onboarding-i tamamlanmış sayır) | ⏳ |
| ONB-07 | API | Maraqları ikinci dəfə saxla | XP təkrar verilmir | ⏳ |

## 3. Lent və paylaşımlar (FEED)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| FEED-01 | UI | Lent: "Sənin üçün" | Paylaşımlar, hekayə halqaları, "Populyar təcrübələr" zolağı; aşağı sürüşdürdükcə yüklənir; yuxarı çəkəndə yenilənir | ⏳ |
| FEED-02 | UI+DB | Paylaşımı bəyən, sonra geri al | Say +1/−1, serverdə uyğun | ⏳ |
| FEED-03 | DB | Başqasının paylaşımını bəyən | Müəllifə bildiriş; bəyən→geri al→bəyən 24 saatda 1 bildiriş | ⏳ |
| FEED-04 | UI+DB | Şərh yaz; şərhə cavab yaz | Şərh sayı artır; cavab kök şərhin altında görünür | ⏳ |
| FEED-05 | UI | Boş və ya yalnız boşluqlu şərh | Göndər deaktiv / xəta; boş şərh yaranmır | ⏳ |
| FEED-06 | UI+DB | Öz şərhini (cavabları ilə) sil | Təsdiq, şərh və cavabları silinir, say doğru azalır | ⏳ |
| FEED-07 | API | Paylaşım sahibi başqasının şərhini silir; kənar şəxs silməyə çalışır | Sahib silə bilir; kənar şəxs 403 | ⏳ |
| FEED-08 | UI | Şərhi bəyən | Ürək dolur, say artır | ⏳ |
| FEED-09 | UI | Paylaşımı saxla → Profil → "İstəklərim" | Paylaşım saxlanılanlarda; geri götürəndə itir | ⏳ |
| FEED-10 | UI+DB | Paylaş → söhbətə sürətli göndər | "Göndərildi", söhbətdə link mesajı, `shareCount` +1 | ⏳ |
| FEED-11 | UI+DB | Başqasının paylaşımını şikayət et (səbəb seç); təkrar et | "Təşəkkürlər"; ikincidə "artıq şikayət etmisiniz"; bazada 1 şikayət | ⏳ |
| FEED-12 | UI | Öz paylaşımında menyu | "Şikayət et" yoxdur, "Paylaşımı sil" var → silinir, lentdən və profildən itir | ⏳ |
| FEED-13 | UI | "İzlədiklərin" tabı | Yalnız izlənənlərin paylaşımları; heç kimi izləmirsənsə boş vəziyyət | ⏳ |
| FEED-14 | UI | "Yaxınlıqda" tabı (simulyator yeri Bakı) | İcazə soruşulur; 50 km daxilindəki paylaşımlar və ya "Bu ətrafda sakitlikdir" | ⏳ |
| FEED-15 | API | "İzləyicilər" və "Yalnız mən" görünürlüklü paylaşımlar | İzləməyən görmür (404); "Yalnız mən" yalnız müəllifə görünür | ⏳ |
| FEED-16 | UI+DB | Mətnli paylaşım (fotosuz) | Yaranır, XP verilmir | ⏳ |
| FEED-17 | UI+DB | 2 fotolu paylaşım + #heşteq + məkan | Fotolar MinIO-da, +300 XP alert, heşteqlər yaşıl, məkan etiketi → məkan detalı | ⏳ |
| FEED-18 | UI | Paylaşım yarat: boş forma | "Paylaş" deaktiv | ⏳ |
| FEED-19 | API | Gündə 6-cı fotolu paylaşım | XP 0, "Gündəlik limit dolub" | ⏳ |
| FEED-20 | UI | Level həddini keçən XP | "Level N-ə yüksəldin!" mesajı, sistem bildirişi | ⏳ |

## 4. Hekayələr (STORY)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| STORY-01 | UI | "Sən" halqası → 1 foto → Paylaş | Hekayə yaranır, "Sən" halqası aktivləşir | ⏳ |
| STORY-02 | UI+DB | Başqasının hekayəsinə bax | 5 san. sonra növbətiyə keçir, sol/sağ toxunuş işləyir, halqa "baxılmış" olur, baxış sayılır | ⏳ |
| STORY-03 | UI | Öz hekayəmə bax | Baxış sayı görünür; hekayəni silmək mümkündür | ⏳ |
| STORY-04 | API | 24 saatdan köhnə hekayə | Görünmür | ⏳ |
| STORY-05 | API | Qapalı hesabın hekayəsi izləməyənə | Görünmür | ⏳ |

## 5. İstifadəçilər, izləmə, bloklama (USER)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| USER-01 | UI | Paylaşımda müəllifə toxun | Profil: statistika, score, tablar (paylaşımlar, marşrutlar, nailiyyətlər) | ⏳ |
| USER-02 | UI+DB | İzlə → izləmədən çıx | Düymə və izləyici sayı dəyişir, serverdə uyğun; müəllifə bildiriş | ⏳ |
| USER-03 | UI | Öz profilim | "İzlə" və "Mesaj" düymələri yoxdur | ⏳ |
| USER-04 | UI | Qapalı hesabın profili | "Bu hesab qapalıdır"; izlədikdən sonra paylaşımlar görünür | ⏳ |
| USER-05 | UI | İzləyicilər / İzləyir siyahıları, tövsiyə olunanlar | Saylar doğru; öz siyahımda tövsiyələr, izlə düyməsi işləyir | ⏳ |
| USER-06 | UI+DB | Profil menyusu → "Blokla" | Qarşılıqlı izləmələr silinir; onun paylaşımları görünmür; Tənzimləmələrdə bloklanmışlar siyahısında | ⏳ |
| USER-07 | UI | Bloklanmışlar → "Bloku götür" | Siyahıdan çıxır, profil yenidən açılır | ⏳ |
| USER-08 | UI+DB | Profil menyusu → "Şikayət et" | Şikayət yazılır | ⏳ |
| USER-09 | API | Özünü izlə / özünü blokla | 400 | ⏳ |

## 6. Mesajlar və bildirişlər (CHAT, NOTIF)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| CHAT-01 | UI+DB | Profildən "Mesaj" → mətn göndər | Söhbət açılır, mesaj görünür, qarşı tərəfdə oxunmamış 1 | ⏳ |
| CHAT-02 | UI | Qarşı tərəf (API ilə) yazır | Mesaj canlı gəlir, siyahıda nişan, açanda oxunur | ⏳ |
| CHAT-03 | UI | Filtr: Hamısı / Local Expert / Biznes / Gezginlər | Siyahı rola görə süzülür | ⏳ |
| CHAT-04 | UI | Boş mesaj | Göndər deaktiv | ⏳ |
| CHAT-05 | UI | Bloklanmış istifadəçiyə yazmaq | "Bu istifadəçi ilə yazışma mümkün deyil" | ⏳ |
| CHAT-06 | UI | Söhbətdə təcrübə kartı → "Bron et" | Bron ekranı açılır | ⏳ |
| CHAT-07 | UI | API işləməyəndə mesaj göndər | Xəta göstərilir, mətn itmir | ⏳ |
| NOTIF-01 | UI | Bəyənmə/şərh/izləmə bildirişi gəlir | Zəngdə nöqtə; siyahıda görünür | ⏳ |
| NOTIF-02 | UI+DB | Bildirişə toxun | Oxunmuş olur, uyğun ekran açılır (paylaşım/profil/nailiyyət) | ⏳ |
| NOTIF-03 | UI | "Hamısını oxu" | Hamısı oxunur, nöqtə itir | ⏳ |
| NOTIF-04 | UI | Tablar Sosial / Sistem | Level və badge bildirişləri "Sistem"də | ⏳ |

## 7. Kəşf, axtarış, xəritə, məkan (EXP)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| EXP-01 | UI | Kəşf tabı, region çipləri | Bölmələr yüklənir, region seçəndə üç bölmə süzülür | ⏳ |
| EXP-02 | UI | Axtarış: 1 hərf; "xinaliq" (ə/ı-sız); mövcud olmayan söz | İpucu; "Xınalıq" tapılır; "Nəticə tapılmadı" | ⏳ |
| EXP-03 | UI | Axtarış nəticəsinin hər növünə toxun (məkan, marşrut, təcrübə, gezgin) | Hər biri öz detal ekranını açır | ⏳ |
| EXP-04 | UI | Məkanlar: region + sıralama | Siyahı dəyişir, "Pulsuz" etiketi giriş haqqı 0 olanlarda | ⏳ |
| EXP-05 | UI | Filtr paneli: kateqoriya, reytinq, giriş haqqı, məsafə → göstər; "Sıfırla" | Düymədəki say siyahıdakı sayla eynidir; "Filtr (N aktiv)"; sıfırlama işləyir | ⏳ |
| EXP-06 | UI | Xəritə: region, klaster, pin → kart → detal | Kamera region üzərinə gedir; klaster yaxınlaşdırır; kart məkanı açır | ⏳ |
| EXP-07 | UI | Məkan detalı | Faktlar, reytinq, rəylər, yaxınlıqdakılar, "Plana əlavə et", "Check-in et" | ⏳ |
| EXP-08 | UI+DB | Məkanı saxla / götür | İkon dəyişir, "İstəklərim"də görünür, serverdə uyğun | ⏳ |
| EXP-09 | UI | Fotolar → Rəsmi / Gezginlərdən → tam ekran | Süzgəc işləyir, sayğac "i / N" | ⏳ |
| EXP-10 | UI | Otellər: Kəşf → otel → biznes profili | Paketlər, zəng/vebsayt, "Rezervasiya" | ⏳ |

## 8. Rəylər (REV)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| REV-01 | UI | Rəy yaz: ulduz seçmədən | Göndər deaktiv | ⏳ |
| REV-02 | UI+DB | 4★ + teq + mətn + foto (fotonu sil, yenisini əlavə et) → göndər | "+400 XP", rəy siyahıda; məkanın reytinqi və rəy sayı yenilənir | ⏳ |
| REV-03 | UI | Eyni məkana ikinci rəy | Redaktə rejimi, "Rəyi yenilə", XP verilmir, reytinq yenidən hesablanır | ⏳ |
| REV-04 | UI | Bütün rəylər: sıralama (yeni, yüksək, aşağı, faydalı), paylanma | Sıralama doğru; faizlər cəmi ~100% | ⏳ |
| REV-05 | UI+DB | "Faydalı" işarələ | Say artır, təkrar toxunuş geri alır | ⏳ |
| REV-06 | API | Gündə 4-cü rəy | XP 0, limit qeydi | ⏳ |
| REV-07 | UI | Təcrübə və marşrut detalında reytinq və rəylər | Görünür, rəy yazmaq mümkündür | ⏳ |
| REV-08 | API | `rating=4` süzgəci | 4 və yuxarı (minimum kimi) | ⏳ |

## 9. Marşrutlar (ROUTE)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| ROUTE-01 | UI | Marşrutlar: müddət çipləri; detal | Süzülür; günlər, dayanacaqlar, məsafə/müddət/məkan sayı; dayanacaq → məkan | ⏳ |
| ROUTE-02 | UI | Marşrutu saxla | "İstəklərim → Marşrutlar"da görünür | ⏳ |
| ROUTE-03 | UI | Marşrut qur: ad <3, region seçilməyib | Yarat düyməsi deaktiv | ⏳ |
| ROUTE-04 | UI+DB | 2 günlük marşrut yarat | +350 XP, redaktor açılır, marşrut defolt olaraq qapalıdır | ⏳ |
| ROUTE-05 | UI | Dayanacaq əlavə et (region məkanları, axtarış) | Yalnız məkanlar çıxır; eyni gündə təkrar məkan ✓ ilə deaktiv | ⏳ |
| ROUTE-06 | UI+DB | Sırala ▲▼, sil, "+ Gün", "İctimai paylaş" | Serverdə sıra, gün sayı və görünürlük uyğun | ⏳ |
| ROUTE-07 | UI | Öz marşrutumu sonradan redaktə etmək (detaldan) | Redaktor açılır | ⏳ |
| ROUTE-08 | API | Qapalı marşrutu başqası açır / plana idxal edir / saxlayır | 404 | ⏳ |
| ROUTE-09 | API | 2 günlük marşruta 3-cü gün dayanacağı (yaratma, yeniləmə) | 400 | ⏳ |
| ROUTE-10 | API | Gündə 3-cü marşrut | XP 0 | ⏳ |

## 10. Təcrübələr (XPR)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| XPR-01 | UI | Təcrübələr: kateqoriya çipləri | Süzülür | ⏳ |
| XPR-02 | UI | Təcrübə detalı | Qiymət "nəfər başına", daxildir, expert, növbəti tarix və qalan yer, 80/20 kartı | ⏳ |
| XPR-03 | UI | Saxla (ürək) | "İstəklərim → Təcrübələr"də görünür | ⏳ |
| XPR-04 | UI | Təcrübəni plana əlavə et | Seçilmiş səyahət gününə düşür | ⏳ |

## 11. Planım / səyahətlər (TRIP)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| TRIP-01 | UI | Yeni səyahət: ad boş → deaktiv; ad + tarix (+7) + 3 nəfər + sıfırdan | Səyahət yaranır, detal açılır, status "Planlanıb" | ⏳ |
| TRIP-02 | UI+DB | Marşrut detalı → "Marşrutu başlat" | Səyahət marşrutun günləri və dayanacaqları ilə yaranır | ⏳ |
| TRIP-03 | UI | Məkan → "Plana əlavə et" → səyahət + gün | Element seçilmiş gündə | ⏳ |
| TRIP-04 | UI+DB | Elementi tamamlandı işarələ | Proqres faizi yenilənir | ⏳ |
| TRIP-05 | UI | "Səyahəti başlat" | Status "Aktiv"; başqa aktiv səyahət varsa o "Planlanıb"a qayıdır | ⏳ |
| TRIP-06 | UI+DB | "Səyahəti tamamla" | Status "Tamamlandı", +500 XP (yalnız ilk dəfə) | ⏳ |
| TRIP-07 | UI | Səyahəti sil | Siyahıdan itir | ⏳ |
| TRIP-08 | UI | Səyahət siyahısı | Status, tarix, gün/nəfər, proqres doğru | ⏳ |
| TRIP-09 | API | Bitmə tarixi başlanğıcdan əvvəl | 400 | ⏳ |

## 12. Check-in (CHK)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| CHK-01 | UI+DB | Simulyator yeri = İçərişəhər → məkan → "Check-in et" | Uğur: "İlk ziyarət", +600 XP, score, "İlk addım" badge, level proqresi | ⏳ |
| CHK-02 | UI | Yer = Bakı, məkan = Xınalıq | "Check-in üçün məkana 1000 m-dən yaxın olmalısınız (hazırda X km)" | ⏳ |
| CHK-03 | UI | Yerləşmə icazəsi rədd edilib | Check-in olmur, icazə tələb edən xəta | ⏳ |
| CHK-04 | UI+DB | Eyni məkanda eyni gün təkrar check-in | Qəbul edilmir və ya XP-siz; sayğac şişmir | ⏳ |
| CHK-05 | API | Gündə 4-cü yeni məkan | XP 0, "gündəlik limit" qeydi | ⏳ |
| CHK-06 | UI | Səyahət elementindən check-in | Element tamamlanır, səyahət proqresi kartı | ⏳ |
| CHK-07 | UI | "Yarat" → "Check-in et" | Check-in üçün məkan seçimi açılır | ⏳ |
| CHK-08 | UI | Regionlar ekranı | Check-in-dən sonra region faizi artır | ⏳ |

## 13. Rezervasiya və ödəniş (BOOK)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| BOOK-01 | UI | Təcrübə → "Bron et": tarix seçimi | Slotlar, dolu slot deaktiv; tarix yoxdursa aydın mesaj | ⏳ |
| BOOK-02 | UI | 2 böyük + 1 uşaq (60 AZN) | 120 + 30 = 150 AZN; böyük min 1 | ⏳ |
| BOOK-03 | UI | Kart əlavə et: səhv nömrə / ay / CVC | Validasiya xətaları; düzgün kart saxlanılır, defolt olur | ⏳ |
| BOOK-04 | UI+DB | `4111…` ilə ödə | "Rezervasiya təsdiqləndi!", GZ- kodlu bilet, +50 XP, slotda yer azalır | ⏳ |
| BOOK-05 | UI+DB | `4000…0002` ilə ödə, sonra `4111…` ilə təkrar | "Kartda kifayət qədər vəsait yoxdur"; ikinci cəhd **eyni** rezervasiyanı ödəyir (dublikat yoxdur) | ⏳ |
| BOOK-06 | UI | `4000…3220`: yanlış OTP, sonra `123456` | OTP ekranı; yanlışda xəta; düzgündə təsdiq | ⏳ |
| BOOK-07 | UI | `4000…0069` | "Kartın müddəti bitib" | ⏳ |
| BOOK-08 | UI | Qalan yerdən çox nəfər | "Bu tarixdə yalnız N yer qalıb" | ⏳ |
| BOOK-09 | UI | Rezervasiyalarım: tablar, karta toxun | Gələcək/Keçmiş/Ləğv; detal və bilet açılır | ⏳ |
| BOOK-10 | UI+DB | ≥48 saat qalmış rezervasiyanı ləğv et | Geri qaytarma siyasəti göstərilir, 100% qaytarılır, status "Ləğv edilib", yer boşalır | ⏳ |
| BOOK-11 | API | 24–48 saat / <24 saat ləğv | 50% / 0% | ⏳ |
| BOOK-12 | UI+DB | Otel paketi: 2 gecə, spa → ödə | 240 + 60 = 300 AZN, çıxış = giriş + 2 gecə, təsdiq | ⏳ |
| BOOK-13 | API | Ödənilməmiş rezervasiya 30 dəqiqədən sonra | Avtomatik ləğv, yer boşalır | ⏳ |
| BOOK-14 | API | Ləğv / geri qaytarılmış rezervasiyanı ödə | 400 | ⏳ |
| BOOK-15 | API | Başqasının ödənişini geri qaytarmaq (`/payments/:id/refund`) | 403 | ⏳ |
| BOOK-16 | API | Başqa istifadəçinin Idempotency-Key-i ilə rezervasiya | Öz yeni rezervasiyası yaranır (açar istifadəçiyə aiddir) | ⏳ |
| BOOK-17 | API | Keçmiş tarixə rezervasiya / keçmiş rezervasiyanı ödə | 400 | ⏳ |
| BOOK-18 | API | Slotsuz (`startAt`) təcrübə bronunda qrup həddi | maxGroup-dan çox → 400 | ⏳ |
| BOOK-19 | API+DB | Bitmiş təsdiqlənmiş təcrübə | "Tamamlandı", +800 XP, statistikada "Təcrübələr" +1 | ⏳ |
| BOOK-20 | UI | Kartlarım: sil, defolt et | Defolt silinəndə növbəti kart defolt olur | ⏳ |

## 14. Profil, tənzimləmələr, oyunlaşdırma (PROF)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| PROF-01 | UI | Profil tabı | Level, tier, XP, score, statistika — hamısı azərbaycanca; rəqəmlər bazaya uyğun | ⏳ |
| PROF-02 | UI+DB | Redaktə: avatar, cover, ad, istifadəçi adı, bio, ev regionu (seç və götür), maraqlar | Hamısı saxlanılır; region götürüləndə serverdə də silinir | ⏳ |
| PROF-03 | UI | Redaktə: ad 1 hərf; bütün maraqları götür | "Ad qısadır"; maraqsız saxlamaq olmur (aydın mesaj) | ⏳ |
| PROF-04 | UI | Tənzimləmələr → Dil: English | Kontent (məkan adları və s.) ingiliscə gəlir; seçim yadda qalır | ⏳ |
| PROF-05 | UI+DB | Bildiriş açarları | Serverdə saxlanılır, yenidən açanda qalır | ⏳ |
| PROF-06 | UI+API | Məxfilik → "İzləyicilər" | Profil başqaları üçün qapalı olur | ⏳ |
| PROF-07 | UI | Hüquqi sənədlər | Açılır və ya aydın mesaj | ⏳ |
| PROF-08 | UI | Regionlar | "d / t region", faiz check-in-lərə uyğun; regiona toxunuş məkanları açır | ⏳ |
| PROF-09 | UI | İstəklərim (saxlanılanlar) | Növ çipləri, saylar, hər elementə toxunuş detala aparır | ⏳ |
| PROF-10 | UI | Gezgin Score ekranı | Score formulaya uyğun; qazanma yollarındakı XP qaydalar cədvəlinə uyğun | ⏳ |
| PROF-11 | UI | Nailiyyətlər | Qazanılan/kilidli, proqres "x / y" doğru | ⏳ |
| PROF-12 | UI | Liderlər: həftəlik / aylıq / bütün zamanlar | Sıralama xala görə; "Sən" sətri | ⏳ |
| PROF-13 | API | `/me/stats.score` = `/me` score; `/xp-rules` XP qaydalarını qaytarır | Uyğundur | ⏳ |

## 15. Moderasiya (mobilə təsiri) (MOD)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| MOD-01 | UI+API | Mobildən şikayət → admin növbəsi | Şikayət admin `/admin/reports`-da | ⏳ |
| MOD-02 | API+UI | Admin kontenti silir | Paylaşım mobil lentdən itir | ⏳ |
| MOD-03 | API+UI | Admin istifadəçini dayandırır | Mobil sessiya növbəti sorğuda bağlanır; girişdə "Hesab dayandırılıb"; bərpadan sonra giriş olur | ⏳ |
| MOD-04 | API | Adi istifadəçi admin endpoint-inə | 403 | ⏳ |

## 16. Ümumi keyfiyyət (X)

| ID | Üsul | Test | Gözlənilən nəticə | Status |
|---|---|---|---|---|
| X-01 | UI | API dayandırılıb: lent, məkan detalı, profil, bron | Çökmə yoxdur; ağ ekran yox — xəta mesajı və "Yenidən cəhd et"/"Geri" | ⏳ |
| X-02 | UI | API geri gəlir | "Yenidən cəhd et" ilə bərpa | ⏳ |
| X-03 | UI | Uzun ad / bio / paylaşım mətni | Layout sınmır | ⏳ |
| X-04 | UI | Bütün ekranlarda "Geri" | Hər ekrandan geri çıxmaq olur | ⏳ |
| X-05 | UI | Azərbaycan interfeysində ingiliscə etiket | Yoxdur | ⏳ |

---

## Test turları

| Tur | Tarix | Nəticə |
|---|---|---|
| 1 | 2026-09-28 | — |
