# GEZGIN — Seed (mock) data

Bu qovluq tətbiqin ilk mərhələsi üçün **mock kontenti** saxlayır. Fayllar CSV-dir — Excel və ya Google Sheets-də açıb doldurmaq olar, sonra `pnpm db:seed` onları MySQL-ə yükləyəcək.

## Doldurma qaydaları

| Qayda | İzah |
|---|---|
| **Kodlaşdırma** | UTF-8 (Excel-də "CSV UTF-8" kimi saxlayın — əks halda ə, ğ, ş pozulur) |
| **Ayırıcı** | vergül `,` |
| **Vergül olan mətn** | dırnaq içində: `"Quba, Azərbaycan"` |
| **Çoxdəyərli sahə** | `\|` ilə ayırın: `beledci\|neqliyyat\|nahar` |
| **`slug`** | latın hərfləri, kiçik, defislə: `xinaliq-kendi` — bütün fayllarda əlaqə açarıdır |
| **Boş sahə** | boş buraxın, `-` və ya `null` yazmayın |
| **Tarix** | `YYYY-MM-DD` |
| **Qiymət** | yalnız rəqəm, AZN: `60` (valyuta simvolu yazmayın) |
| **`lat` / `lng`** | onluq dərəcə, 6 rəqəmə qədər: `41.189700` |

> ⚠️ Fayllardakı nümunə sətirlər dizayn ekranlarından götürülüb və **koordinatlar təxminidir** — istifadədən əvvəl yoxlanmalıdır.

## Fayllar və doldurma sırası

Sıra vacibdir — sonrakı fayllar əvvəlkilərin `slug`-una istinad edir.

| # | Fayl | Nə üçün | Minimum (dev) | Hədəf (demo) |
|---|---|---|---|---|
| 1 | `01-regions.csv` | Regionlar | 6 | 50 |
| 2 | `02-places.csv` | Məkanlar | 30 | 200 |
| 3 | `03-routes.csv` | Marşrutlar | 5 | 20 |
| 4 | `04-route-stops.csv` | Marşrut dayanacaqları | 20 | 120 |
| 5 | `05-users.csv` | Mock gezginlər və Local Expert-lər | 10 | 40 |
| 6 | `06-experiences.csv` | Təcrübələr | 10 | 30 |
| 7 | `07-events.csv` | Tədbirlər | 5 | 25 |
| 8 | `08-businesses.csv` | Bizneslər (otel, restoran) | 3 | 15 |
| 9 | `09-business-packages.csv` | Biznes paketləri | 6 | 30 |

**Sistem konfiqurasiyası** (aşağıdakılar prezentasiyadan doldurulub — yalnız təsdiq lazımdır):
`config-categories.csv` · `config-levels.csv` · `config-badges.csv` · `config-xp-rules.csv`

## Fotolar

`photos` sütununa fayl adı yazın (`|` ilə bir neçəsi). Faylları `seed/photos/` qovluğuna atın.
Hələlik `design/assets/` içindəki şəkillərdən istifadə etmək olar — məsələn `place-xinaliq.jpg`.

## Təsdiq gözləyən məsələ — level sistemi

Prezentasiya öz-özü ilə ziddiyyətlidir:
- **Slayd 8:** 5 səviyyə — Level 1 Başlanğıc … Level 5 Gezgin
- **Tətbiq ekranları:** Aysel **Level 12 "Kəşf edən"**, Tural **Level 14**, badge **"Əfsanə — Level 20"**

`config-levels.csv`-də təklif etdiyim həll: **20 nömrəli level**, slayd 8-dəki 5 ad isə **tier (dərəcə)** kimi level aralıqlarına bağlanır. Beləliklə hər iki mənbə uyğunlaşır. Fayldakı `tier_az` sütununu nəzərdən keçirin.


## Sosial kontent (Sprint 7)

| Fayl | Nədir | Açar (idempotentlik) |
|---|---|---|
| `11-posts.csv` | Paylaşımlar — mətn, məkan, marşrut, fotolar, bəyənənlər | müəllif + mətn |
| `12-follows.csv` | Kim kimi izləyir | izləyən + izlənən |
| `13-comments.csv` | Şərhlər; `reply_to` — kimin kök şərhinə cavabdır | paylaşım + müəllif + mətn |
| `14-stories.csv` | Hekayələr | müəllif + foto |

- `ref` (`11-posts.csv`) yalnız şərhlərin paylaşıma istinadı üçündür, bazaya yazılmır.
- `hours_ago` / `minutes_after` — vaxt seed-in işlədiyi andan hesablanır.
- Paylaşımın koordinatı məkandan götürülür — **Nearby** lenti yalnız məkanı olan paylaşımları göstərir.
- Hekayələr 24 saat yaşayır: `pnpm db:seed` hər dəfə onları yenidən aktivləşdirir.
- Heşteqlər mətndən avtomatik çıxarılır (`#Xınalıq` → `xınalıq`), ayrıca sütun lazım deyil.

## Admin hesabı

Seed hər dev mühitində panel üçün bir admin yaradır:

```
username: admin.demo          (ADMIN_SEED_USERNAME ilə dəyişir)
şifrə:    Sifre12345          (ADMIN_SEED_PASSWORD ilə dəyişir)
```

`NODE_ENV=production` olanda bu addım atlanılır — produksiyada admin əl ilə yaradılmalıdır.
