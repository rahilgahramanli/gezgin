/**
 * Hüquqi sənədlərin mətni — mobil tətbiq onları öz ekranında göstərir.
 *
 * Mətn platformanın faktiki qaydalarına bağlıdır (ləğv faizləri, ödəniş
 * vaxtı, moderasiya müddəti). Qayda dəyişəndə buranı da yeniləyin və
 * `version`-u artırın. Yayımdan əvvəl hüquqşünas tərəfindən yoxlanılmalıdır.
 *
 * İngilis və rus versiyaları (`LEGAL_TRANSLATIONS`) az mətnin eyni quruluşda
 * tərcüməsidir — az mətn dəyişəndə onlar da yenilənməlidir (versiya ortaqdır).
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

/** Tərcümə — başlıq və bölmələr; versiya və tarix az sənədindən götürülür. */
export interface LegalTranslation {
  title: string;
  sections: LegalSection[];
}

export const LEGAL_TRANSLATIONS: Record<'en' | 'ru', Record<string, LegalTranslation>> = {
  en: {
    terms: {
      title: 'Terms of Use',
      sections: [
        {
          heading: '1. General provisions',
          body:
            'GEZGIN is a platform for exploring the regions of Azerbaijan, planning trips, booking experiences and hotel packages, and sharing your travel impressions. By using the app you accept these terms. The service may be used by persons aged 16 and over.',
        },
        {
          heading: '2. Account',
          body:
            'When registering, you must provide accurate information and must not share your password with anyone. You are responsible for all activity in your account. In guest mode you can browse content; liking, commenting, posting, trip planning, check-ins, bookings and messaging require an account.',
        },
        {
          heading: '3. User content',
          body:
            'You keep the rights to the photos, texts, stories and reviews you share. To display them on the platform, you grant GEZGIN a non-exclusive, royalty-free right to use them. Content that is offensive, hateful, spam, advertising, false or that infringes someone else’s copyright is prohibited. You can report any post or user — reports are reviewed within 24 hours. Content that breaks the rules is removed, and repeated violations lead to account suspension.',
        },
        {
          heading: '4. Bookings and payment',
          body:
            'Experiences are offered by Local Experts and hotel packages by the respective businesses; GEZGIN acts as an intermediary between the parties. Prices are shown in AZN. A booking takes effect once payment is confirmed; a booking that is not paid within 30 minutes is cancelled automatically and the spot is released.\n\nCancellation policy: if more than 48 hours remain before the start, 100% of the amount is refunded; if 24–48 hours remain, 50% is refunded; if less than 24 hours remain or the experience has already started, no refund is given. Refunds are made to the card used for payment.',
        },
        {
          heading: '5. XP, levels and badges',
          body:
            'XP, Gezgin Score, levels and badges awarded for check-ins, reviews, posts, routes and bookings have no monetary value and cannot be transferred to anyone else. A check-in is accepted only when you are within 1 km of the place. If abuse of the system (fake location, automation) is detected, earned points may be cancelled. XP for a cancelled booking is revoked.',
        },
        {
          heading: '6. Limitation of liability',
          body:
            'Information about places, routes and weather is provided for reference only. Following safety rules while travelling is the user’s own responsibility. The party that provides an experience or service is responsible for its quality.',
        },
        {
          heading: '7. Deleting your account',
          body:
            'You can delete your account at any time in Settings → Delete account. After deletion, your personal data is deleted or anonymised, and your email address and username become available for use again.',
        },
        {
          heading: '8. Changes and contact',
          body:
            'When these terms change, the new version is published in the app. You can send your questions to the GEZGIN Support team in the Messages section of the app. These terms are governed by the laws of the Republic of Azerbaijan.',
        },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      sections: [
        {
          heading: '1. Information we collect',
          body:
            'Account: name, username, email address and an irreversible hash of your password.\nProfile: photo, cover, bio, home region and interests.\nContent: posts, stories, comments, reviews, messages, routes and trip plans.\nLocation: only if you grant permission and only while the app is open — to verify check-ins and for the “Nearby” feed and nearby places. Location is not collected in the background.\nBookings and payments: booking details; the full card number and CVC are not stored — only the last 4 digits, the card type and the payment provider’s token.\nTechnical: IP address, device type and request logs (for security and troubleshooting).',
        },
        {
          heading: '2. How we use information',
          body:
            'To provide the service (profile, feed, bookings), to verify that a check-in was made at the place, to recommend content based on your interests, to calculate XP and rankings, to prevent abuse and to moderate reports.',
        },
        {
          heading: '3. Who we share it with',
          body:
            'Your profile and posts are visible to other users according to your privacy setting (Everyone / Followers / Only me). When you make a booking, your name and the number of guests are passed to the party providing the experience or package. Payment data is processed by the payment provider. We do not sell your data or pass it to advertising companies.',
        },
        {
          heading: '4. How long we keep it',
          body:
            'Data is kept for as long as your account is active. When the account is deleted, personal data is deleted or anonymised; financial records that must be kept by law (payments, refunds) are retained for the required period.',
        },
        {
          heading: '5. Your rights',
          body:
            'You can change your profile details in Edit profile, manage privacy and notification preferences in Settings, block any user, withdraw location permission in your device settings and delete your account.',
        },
        {
          heading: '6. Children',
          body: 'GEZGIN is not intended for persons under 16, and we do not knowingly collect their data.',
        },
        {
          heading: '7. Security',
          body:
            'Passwords are stored as hashes, sessions are protected with short-lived tokens and suspicious sign-ins are limited. No system is completely secure — if you notice suspicious activity in your account, change your password and contact us.',
        },
        {
          heading: '8. Contact',
          body: 'For privacy requests, write to the GEZGIN Support team in the Messages section of the app.',
        },
      ],
    },
    'expert-terms': {
      title: 'Local Expert Terms',
      sections: [
        {
          heading: '1. Who is a Local Expert',
          body:
            'A Local Expert is a user approved by GEZGIN who offers experiences (tours, masterclasses, hikes, etc.) in their region. The expert is responsible for the safety of the experience, for it matching its description and for holding it on time.',
        },
        {
          heading: '2. Revenue split',
          body:
            'For each confirmed booking, 80% of the experience amount goes to the expert and 20% goes to GEZGIN as the platform commission. No commission is charged on cancelled bookings.',
        },
        {
          heading: '3. Dates and spots',
          body:
            'The expert sets the dates and the number of spots for the experience. An expert may cancel an accepted booking only for a valid reason; in that case the participant receives a 100% refund.',
        },
      ],
    },
  },
  ru: {
    terms: {
      title: 'Условия использования',
      sections: [
        {
          heading: '1. Общие положения',
          body:
            'GEZGIN — платформа, где можно открывать для себя регионы Азербайджана, планировать поездки, бронировать впечатления и отельные пакеты, а также делиться фотографиями и отзывами о путешествиях. Пользуясь приложением, вы принимаете настоящие условия. Сервисом могут пользоваться лица старше 16 лет.',
        },
        {
          heading: '2. Аккаунт',
          body:
            'При регистрации необходимо указывать достоверные данные и не передавать свой пароль другим лицам. Вы несёте ответственность за все действия в своём аккаунте. В гостевом режиме можно просматривать контент; для отметок «Нравится», комментариев, публикаций, планов поездок, чек-инов, бронирований и переписки нужен аккаунт.',
        },
        {
          heading: '3. Пользовательский контент',
          body:
            'Права на фото, тексты, истории и отзывы, которыми вы делитесь, остаются за вами. Чтобы показывать их на платформе, вы предоставляете GEZGIN неисключительное безвозмездное право на их использование. Запрещён оскорбительный контент, разжигание ненависти, спам, реклама, ложная информация и контент, нарушающий чужие авторские права. На любую публикацию и любого пользователя можно пожаловаться — жалобы рассматриваются в течение 24 часов. Контент, нарушающий правила, удаляется, а при повторных нарушениях аккаунт блокируется.',
        },
        {
          heading: '4. Бронирование и оплата',
          body:
            'Впечатления предлагают Local Expert, а отельные пакеты — соответствующие компании; GEZGIN выступает посредником между сторонами. Цены указаны в AZN. Бронирование вступает в силу после подтверждения оплаты; бронирование, не оплаченное в течение 30 минут, автоматически отменяется, а место освобождается.\n\nПравила отмены: если до начала осталось больше 48 часов, возвращается 100% суммы, если от 24 до 48 часов — 50%; если осталось меньше 24 часов или впечатление уже началось, деньги не возвращаются. Возврат производится на карту, с которой была оплата.',
        },
        {
          heading: '5. XP, уровни и достижения',
          body:
            'XP, Gezgin Score, уровни и достижения, которые начисляются за чек-ины, отзывы, публикации, маршруты и бронирования, не имеют денежной стоимости и не передаются другим лицам. Чек-ин засчитывается, только если вы находитесь не дальше 1 км от места. При выявлении злоупотреблений (поддельная геопозиция, автоматизация) заработанные баллы могут быть аннулированы. XP за отменённое бронирование списываются.',
        },
        {
          heading: '6. Ограничение ответственности',
          body:
            'Сведения о местах, маршрутах и погоде носят справочный характер. Соблюдение правил безопасности в поездке — ответственность самого пользователя. За качество впечатлений и услуг отвечает сторона, которая их предоставляет.',
        },
        {
          heading: '7. Удаление аккаунта',
          body:
            'Удалить аккаунт можно в любой момент в разделе Настройки → Удалить аккаунт. После удаления ваши персональные данные удаляются или обезличиваются, а e-mail и имя пользователя снова становятся доступны для регистрации.',
        },
        {
          heading: '8. Изменения и связь',
          body:
            'При изменении условий новая версия публикуется в приложении. Вопросы можно задать команде поддержки GEZGIN в разделе «Сообщения» приложения. Настоящие условия регулируются законодательством Азербайджанской Республики.',
        },
      ],
    },
    privacy: {
      title: 'Политика конфиденциальности',
      sections: [
        {
          heading: '1. Какие данные мы собираем',
          body:
            'Аккаунт: имя, имя пользователя, e-mail и необратимый хеш пароля.\nПрофиль: фото, обложка, описание, домашний регион и интересы.\nКонтент: публикации, истории, комментарии, отзывы, сообщения, маршруты и планы поездок.\nГеопозиция: только с вашего разрешения и только когда приложение открыто — для проверки чек-ина, ленты «Рядом» и мест поблизости. В фоновом режиме геопозиция не собирается.\nБронирования и платежи: данные бронирования; полный номер карты и CVC не хранятся — только последние 4 цифры, тип карты и токен платёжного провайдера.\nТехнические данные: IP-адрес, тип устройства и журналы запросов (для безопасности и разбора ошибок).',
        },
        {
          heading: '2. Как мы используем данные',
          body:
            'Чтобы предоставлять сервис (профиль, лента, бронирования), проверять, что чек-ин сделан на месте, рекомендовать контент по вашим интересам, начислять XP и рассчитывать рейтинги, предотвращать злоупотребления и рассматривать жалобы.',
        },
        {
          heading: '3. С кем мы делимся данными',
          body:
            'Ваш профиль и публикации видны другим пользователям в соответствии с выбранной настройкой приватности (Все / Подписчики / Только я). При бронировании ваше имя и количество гостей передаются стороне, которая предоставляет впечатление или пакет. Платёжные данные обрабатывает платёжный провайдер. Мы не продаём ваши данные и не передаём их рекламным компаниям.',
        },
        {
          heading: '4. Срок хранения',
          body:
            'Данные хранятся, пока аккаунт активен. При удалении аккаунта персональные данные удаляются или обезличиваются; финансовые записи, которые требуется хранить по закону (платежи, возвраты), хранятся в течение установленного срока.',
        },
        {
          heading: '5. Ваши права',
          body:
            'Вы можете изменить данные профиля в разделе «Редактировать профиль», управлять приватностью и уведомлениями в «Настройках», заблокировать любого пользователя, отозвать доступ к геопозиции в настройках устройства и удалить аккаунт.',
        },
        {
          heading: '6. Дети',
          body: 'GEZGIN не предназначен для лиц младше 16 лет, и мы сознательно не собираем их данные.',
        },
        {
          heading: '7. Безопасность',
          body:
            'Пароли хранятся в виде хешей, сессии защищены краткосрочными токенами, подозрительные попытки входа ограничиваются. Ни одна система не защищена полностью — если вы заметили подозрительную активность в аккаунте, смените пароль и напишите нам.',
        },
        {
          heading: '8. Связь',
          body: 'По вопросам конфиденциальности пишите команде поддержки GEZGIN в разделе «Сообщения» приложения.',
        },
      ],
    },
    'expert-terms': {
      title: 'Условия для Local Expert',
      sections: [
        {
          heading: '1. Кто такой Local Expert',
          body:
            'Local Expert — одобренный GEZGIN пользователь, который проводит впечатления (туры, мастер-классы, походы и т. п.) в своём регионе. Эксперт отвечает за безопасность впечатления, его соответствие описанию и проведение в срок.',
        },
        {
          heading: '2. Распределение дохода',
          body:
            'С каждого подтверждённого бронирования 80% стоимости впечатления получает эксперт, а 20% — GEZGIN в качестве комиссии платформы. С отменённых бронирований комиссия не взимается.',
        },
        {
          heading: '3. Даты и места',
          body:
            'Эксперт сам определяет даты и количество мест для впечатления. Отменить принятое бронирование эксперт может только по уважительной причине; в этом случае участнику возвращается 100% оплаты.',
        },
      ],
    },
  },
};
