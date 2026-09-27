/**
 * Hüquqi sənədlərin mətni — mobil tətbiq onları öz ekranında göstərir.
 *
 * Mətn platformanın faktiki qaydalarına bağlıdır (ləğv faizləri, ödəniş
 * vaxtı, moderasiya müddəti). Qayda dəyişəndə buranı da yeniləyin və
 * `version`-u artırın. Yayımdan əvvəl hüquqşünas tərəfindən yoxlanılmalıdır.
 */
export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  titleAz: string;
  version: string;
  updatedAt: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    titleAz: 'İstifadə şərtləri',
    version: '1.0',
    updatedAt: '2026-09-28',
    sections: [
      {
        heading: '1. Ümumi müddəalar',
        body:
          'GEZGIN Azərbaycanın regionlarını kəşf etmək, səyahət planlamaq, təcrübə və otel paketlərini bron etmək və təəssüratları paylaşmaq üçün platformadır. Tətbiqdən istifadə etməklə bu şərtləri qəbul etmiş olursunuz. Xidmətdən 16 yaşdan yuxarı şəxslər istifadə edə bilər.',
      },
      {
        heading: '2. Hesab',
        body:
          'Qeydiyyat zamanı düzgün məlumat verməli və şifrənizi başqaları ilə paylaşmamalısınız. Hesabınızda baş verən fəaliyyətə görə siz cavabdehsiniz. Qonaq rejimində kontentə baxmaq mümkündür; bəyənmə, şərh, paylaşım, səyahət planı, check-in, rezervasiya və mesajlaşma üçün hesab yaratmaq lazımdır.',
      },
      {
        heading: '3. İstifadəçi kontenti',
        body:
          'Paylaşdığınız foto, mətn, hekayə və rəylərin hüquqları sizdə qalır. Onları platformada göstərmək üçün GEZGIN-ə qeyri-müstəsna, ödənişsiz istifadə hüququ verirsiniz. Təhqiredici, nifrət yayan, spam, reklam, yanlış məlumat və ya başqasının müəllif hüququnu pozan kontent qadağandır. İstənilən paylaşımı və istifadəçini şikayət edə bilərsiniz — şikayətlərə 24 saat ərzində baxılır. Qaydaları pozan kontent silinir, təkrar pozuntuda hesab dayandırılır.',
      },
      {
        heading: '4. Rezervasiya və ödəniş',
        body:
          'Təcrübələri Local Expert-lər, otel paketlərini isə müvafiq bizneslər təqdim edir; GEZGIN tərəflər arasında vasitəçidir. Qiymətlər AZN ilə göstərilir. Rezervasiya ödəniş təsdiqlənəndə qüvvəyə minir; 30 dəqiqə ərzində ödənilməyən rezervasiya avtomatik ləğv olunur və yer boşaldılır.\n\nLəğv siyasəti: başlanğıca 48 saatdan çox qalıbsa məbləğin 100%-i, 24–48 saat qalıbsa 50%-i geri qaytarılır; 24 saatdan az qalıbsa və ya təcrübə başlayıbsa geri qaytarma edilmir. Geri qaytarma ödəniş edilən karta köçürülür.',
      },
      {
        heading: '5. XP, səviyyə və nailiyyətlər',
        body:
          'Check-in, rəy, paylaşım, marşrut və rezervasiya üçün verilən XP, Gezgin Score, səviyyə və badge-lərin pul dəyəri yoxdur və başqasına ötürülmür. Check-in yalnız məkana 1 km-dən yaxın olduqda qəbul edilir. Sistemdən sui-istifadə (saxta mövqe, avtomatlaşdırma) aşkar edilərsə qazanılmış xallar ləğv edilə bilər. Ləğv edilən rezervasiyanın XP-si geri alınır.',
      },
      {
        heading: '6. Məsuliyyətin məhdudlaşdırılması',
        body:
          'Məkan, marşrut və hava ilə bağlı məlumatlar məlumat xarakterlidir. Səyahət zamanı təhlükəsizlik qaydalarına əməl etmək istifadəçinin öz məsuliyyətidir. Təcrübə və xidmətlərin keyfiyyətinə görə onları təqdim edən tərəf cavabdehdir.',
      },
      {
        heading: '7. Hesabın silinməsi',
        body:
          'Hesabınızı istənilən vaxt Tənzimləmələr → Hesabı sil bölməsindən silə bilərsiniz. Silinmədən sonra şəxsi məlumatlarınız silinir və ya anonimləşdirilir, e-mail və istifadəçi adı yenidən istifadəyə açılır.',
      },
      {
        heading: '8. Dəyişikliklər və əlaqə',
        body:
          'Şərtlər dəyişəndə yeni versiya tətbiqdə dərc olunur. Suallarınızı tətbiqdəki Mesajlar bölməsindən GEZGIN Dəstək komandasına yaza bilərsiniz. Bu şərtlər Azərbaycan Respublikasının qanunvericiliyinə əsasən tənzimlənir.',
      },
    ],
  },
  privacy: {
    titleAz: 'Məxfilik siyasəti',
    version: '1.0',
    updatedAt: '2026-09-28',
    sections: [
      {
        heading: '1. Topladığımız məlumatlar',
        body:
          'Hesab: ad, istifadəçi adı, e-mail, şifrənin geri çevrilməz heşi.\nProfil: foto, cover, bio, ev regionu, maraqlar.\nKontent: paylaşımlar, hekayələr, şərhlər, rəylər, mesajlar, marşrut və səyahət planları.\nYerləşmə: yalnız icazə versəniz və yalnız tətbiq açıq olanda — check-in yoxlaması, "Yaxınlıqda" lenti və yaxın məkanlar üçün. Fon rejimində mövqe toplanmır.\nRezervasiya və ödəniş: rezervasiya detalları; kartın tam nömrəsi və CVC saxlanılmır — yalnız son 4 rəqəm, kart növü və ödəniş provayderinin tokeni.\nTexniki: IP ünvanı, cihaz növü, sorğu jurnalları (təhlükəsizlik və xəta araşdırması üçün).',
      },
      {
        heading: '2. Məlumatlardan necə istifadə edirik',
        body:
          'Xidməti göstərmək (profil, lent, rezervasiya), check-in-in məkanda edildiyini yoxlamaq, maraqlarınıza uyğun tövsiyə vermək, XP və reytinqləri hesablamaq, sui-istifadənin qarşısını almaq və şikayətləri moderasiya etmək üçün.',
      },
      {
        heading: '3. Kimlə paylaşırıq',
        body:
          'Profiliniz və paylaşımlarınız məxfilik seçiminizə uyğun olaraq digər istifadəçilərə görünür (Hamı / İzləyicilər / Yalnız mən). Rezervasiya etdikdə adınız və nəfər sayı təcrübəni və ya paketi təqdim edən tərəfə ötürülür. Ödəniş məlumatları ödəniş provayderi ilə emal olunur. Məlumatlarınızı satmırıq və reklam şirkətlərinə vermirik.',
      },
      {
        heading: '4. Saxlama müddəti',
        body:
          'Məlumatlar hesab aktiv olduqca saxlanılır. Hesab silinəndə şəxsi məlumatlar silinir və ya anonimləşdirilir; qanunla saxlanması tələb olunan maliyyə qeydləri (ödəniş, geri qaytarma) müvafiq müddət ərzində saxlanılır.',
      },
      {
        heading: '5. Hüquqlarınız',
        body:
          'Profil məlumatlarınızı Profili redaktə et bölməsindən dəyişə, məxfilik və bildiriş seçimlərini Tənzimləmələrdən idarə edə, istənilən istifadəçini bloklaya, yerləşmə icazəsini cihaz ayarlarından geri götürə və hesabınızı silə bilərsiniz.',
      },
      {
        heading: '6. Uşaqlar',
        body: 'GEZGIN 16 yaşdan kiçik şəxslər üçün nəzərdə tutulmayıb və onların məlumatlarını bilərəkdən toplamırıq.',
      },
      {
        heading: '7. Təhlükəsizlik',
        body:
          'Şifrələr heşlənmiş şəkildə saxlanılır, sessiyalar qısamüddətli tokenlərlə qorunur, şübhəli girişlər məhdudlaşdırılır. Heç bir sistem tam təhlükəsiz deyil — hesabınızda şübhəli fəaliyyət görsəniz şifrənizi dəyişin və bizə yazın.',
      },
      {
        heading: '8. Əlaqə',
        body: 'Məxfiliklə bağlı sorğular üçün tətbiqdəki Mesajlar bölməsindən GEZGIN Dəstək komandasına yazın.',
      },
    ],
  },
  'expert-terms': {
    titleAz: 'Local Expert şərtləri',
    version: '1.0',
    updatedAt: '2026-09-28',
    sections: [
      {
        heading: '1. Local Expert kimdir',
        body:
          'Local Expert öz regionunda təcrübə (tur, masterklass, yürüş və s.) təqdim edən, GEZGIN tərəfindən təsdiqlənmiş istifadəçidir. Təcrübənin təhlükəsizliyinə, təsvirə uyğunluğuna və vaxtında keçirilməsinə expert cavabdehdir.',
      },
      {
        heading: '2. Gəlir bölgüsü',
        body:
          'Hər təsdiqlənmiş rezervasiyanın təcrübə məbləğinin 80%-i expertə, 20%-i platforma komissiyası kimi GEZGIN-ə çatır. Ləğv edilmiş rezervasiya üzrə komissiya hesablanmır.',
      },
      {
        heading: '3. Tarix və yerlər',
        body:
          'Expert təcrübə üçün tarix və yer sayını özü müəyyən edir. Qəbul edilmiş rezervasiyanı expert tərəfindən ləğv etmək yalnız üzrlü səbəbdən mümkündür; bu halda iştirakçıya ödənişin 100%-i qaytarılır.',
      },
    ],
  },
};
