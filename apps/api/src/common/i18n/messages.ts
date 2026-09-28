import { enPlural, ruPlural } from './format';
import type { Lang } from './lang';

/**
 * Xəta mesajlarının kataloqu — kodda mesajlar Azərbaycan dilində yazılır,
 * qlobal filter onları cavab verməzdən əvvəl `Accept-Language`-ə görə tərcümə edir.
 *
 * Qaydalar:
 *  - az üçün mesaj HEÇ VAXT dəyişmir (QA skripti və admin paneli az mətnə baxır);
 *  - kataloqda olmayan mesaj olduğu kimi qalır (fallback);
 *  - dəyişənli mesajlar (`Məkan tapılmadı: <slug>`) şablonla tutulur.
 * Yeni `throw new …Exception({ message })` əlavə edəndə buraya da əlavə edin —
 * `messages.spec.ts` mənbə kodundakı bütün az mesajlarının kataloqda olduğunu yoxlayır.
 */
interface Tr {
  en: string;
  ru: string;
}

export const EXACT_MESSAGES: Record<string, Tr> = {
  // ───── ümumi, guard-lar, filter ─────
  'Gözlənilməz xəta baş verdi': { en: 'An unexpected error occurred', ru: 'Произошла непредвиденная ошибка' },
  'Validasiya xətası': { en: 'Validation error', ru: 'Ошибка валидации' },
  'Token vaxtı bitib': { en: 'The token has expired', ru: 'Срок действия токена истёк' },
  'Bu əməliyyat üçün daxil olmalısınız': { en: 'You need to sign in to do this', ru: 'Для этого действия нужно войти' },
  'Bu əməliyyat üçün hesab yaratmalısınız': { en: 'You need to create an account to do this', ru: 'Для этого действия нужно создать аккаунт' },
  'Yanlış cursor': { en: 'Invalid cursor', ru: 'Неверный курсор' },

  // ───── auth ─────
  'Bu e-mail artıq qeydiyyatdadır': { en: 'This email is already registered', ru: 'Этот e-mail уже зарегистрирован' },
  'Bu istifadəçi adı tutulub': { en: 'This username is already taken', ru: 'Это имя пользователя уже занято' },
  'E-mail və ya şifrə yanlışdır': { en: 'Incorrect email or password', ru: 'Неверный e-mail или пароль' },
  'Hesab dayandırılıb': { en: 'The account has been suspended', ru: 'Аккаунт заблокирован' },
  'Hesab aktiv deyil': { en: 'The account is not active', ru: 'Аккаунт неактивен' },
  'Hesab tapılmadı və ya aktiv deyil': { en: 'Account not found or not active', ru: 'Аккаунт не найден или неактивен' },
  'İstifadəçi tapılmadı': { en: 'User not found', ru: 'Пользователь не найден' },
  'Bu hesabda şifrə təyin olunmayıb': { en: 'No password is set for this account', ru: 'Для этого аккаунта не задан пароль' },
  'Cari şifrə yanlışdır': { en: 'The current password is incorrect', ru: 'Текущий пароль неверен' },
  'Sosial hesabdan e-mail alınmadı — e-mail ilə qeydiyyatdan keçin': {
    en: 'Could not get an email from the social account — sign up with email',
    ru: 'Не удалось получить e-mail из соцсети — зарегистрируйтесь по e-mail',
  },
  'Saatda 5-dən çox kod göndərilə bilməz': { en: 'No more than 5 codes can be sent per hour', ru: 'Можно отправить не более 5 кодов в час' },
  'Kod tapılmadı və ya artıq istifadə olunub': { en: 'Code not found or already used', ru: 'Код не найден или уже использован' },
  'Kodun vaxtı bitib': { en: 'The code has expired', ru: 'Срок действия кода истёк' },
  'Çox sayda yanlış cəhd — yeni kod istəyin': { en: 'Too many wrong attempts — request a new code', ru: 'Слишком много неверных попыток — запросите новый код' },
  'Kod yanlışdır': { en: 'Incorrect code', ru: 'Неверный код' },
  'Refresh token tanınmadı': { en: 'Refresh token not recognised', ru: 'Refresh-токен не распознан' },
  'Token təkrar istifadə edildi — bütün sessiyalar bağlandı': {
    en: 'The token was reused — all sessions have been closed',
    ru: 'Токен использован повторно — все сессии закрыты',
  },
  'Refresh token vaxtı bitib': { en: 'The refresh token has expired', ru: 'Срок действия refresh-токена истёк' },
  'Mock rejimdə token "mock:<email>" formatında olmalıdır': {
    en: 'In mock mode the token must have the "mock:<email>" format',
    ru: 'В mock-режиме токен должен иметь формат "mock:<email>"',
  },
  'Mock tokendə e-mail yanlışdır': { en: 'Invalid email in the mock token', ru: 'Неверный e-mail в mock-токене' },
  'GOOGLE_CLIENT_ID konfiqurasiya olunmayıb': { en: 'GOOGLE_CLIENT_ID is not configured', ru: 'GOOGLE_CLIENT_ID не настроен' },
  'APPLE_CLIENT_ID konfiqurasiya olunmayıb': { en: 'APPLE_CLIENT_ID is not configured', ru: 'APPLE_CLIENT_ID не настроен' },
  'İstifadəçi adı 3–32 simvol: a-z, 0-9, nöqtə, alt xətt': {
    en: 'Username must be 3–32 characters: a-z, 0-9, dot, underscore',
    ru: 'Имя пользователя — 3–32 символа: a-z, 0-9, точка, подчёркивание',
  },
  'E-mail düzgün deyil': { en: 'Invalid email address', ru: 'Некорректный e-mail' },
  'Şifrə ən azı 8 simvol olmalıdır': { en: 'The password must be at least 8 characters', ru: 'Пароль должен содержать не менее 8 символов' },
  'Kod 6 rəqəm olmalıdır': { en: 'The code must be 6 digits', ru: 'Код должен состоять из 6 цифр' },
  // WebSocket qoşulması
  'Token göndərilməyib': { en: 'No token provided', ru: 'Токен не передан' },
  'Token etibarsızdır': { en: 'Invalid token', ru: 'Недействительный токен' },
  'Çat üçün hesab yaratmalısınız': { en: 'You need to create an account to use chat', ru: 'Для чата нужно создать аккаунт' },

  // ───── profil, sosial ─────
  'Özünüzü bloklaya bilməzsiniz': { en: 'You cannot block yourself', ru: 'Нельзя заблокировать самого себя' },
  'Özünüzü izləyə bilməzsiniz': { en: 'You cannot follow yourself', ru: 'Нельзя подписаться на самого себя' },
  'Ən azı 1 maraq seçin': { en: 'Choose at least 1 interest', ru: 'Выберите хотя бы 1 интерес' },
  'Öz kontentinizi şikayət edə bilməzsiniz': { en: 'You cannot report your own content', ru: 'Нельзя пожаловаться на собственный контент' },
  'Media tapılmadı': { en: 'Media not found', ru: 'Медиафайл не найден' },
  'Media tapılmadı və ya yüklənməyib': { en: 'Media not found or not uploaded', ru: 'Медиафайл не найден или не загружен' },
  'Bu media sizə aid deyil': { en: 'This media does not belong to you', ru: 'Этот медиафайл вам не принадлежит' },
  'Cover media tapılmadı': { en: 'Cover media not found', ru: 'Обложка не найдена' },
  'Fayl anbarda tapılmadı — yükləmə tamamlanmayıb': {
    en: 'The file was not found in storage — the upload was not completed',
    ru: 'Файл не найден в хранилище — загрузка не завершена',
  },

  // ───── paylaşım, şərh, hekayə ─────
  'Paylaşım tapılmadı': { en: 'Post not found', ru: 'Публикация не найдена' },
  'Bu paylaşım sizə aid deyil': { en: 'This post does not belong to you', ru: 'Эта публикация вам не принадлежит' },
  'Paylaşım üçün mətn və ya foto lazımdır': { en: 'A post needs text or a photo', ru: 'Для публикации нужен текст или фото' },
  'Fotosuz paylaşımın mətni boş ola bilməz': { en: 'A post without photos cannot have empty text', ru: 'У публикации без фото текст не может быть пустым' },
  'Yaxınlıq lenti üçün lat və lng lazımdır': { en: 'lat and lng are required for the nearby feed', ru: 'Для ленты «Рядом» нужны lat и lng' },
  'Şərh boş ola bilməz': { en: 'A comment cannot be empty', ru: 'Комментарий не может быть пустым' },
  'Cavab verilən şərh tapılmadı': { en: 'The comment you are replying to was not found', ru: 'Комментарий, на который вы отвечаете, не найден' },
  'Şərh tapılmadı': { en: 'Comment not found', ru: 'Комментарий не найден' },
  'Bu şərhi silə bilməzsiniz': { en: 'You cannot delete this comment', ru: 'Вы не можете удалить этот комментарий' },
  'Hekayə tapılmadı': { en: 'Story not found', ru: 'История не найдена' },
  'Hekayə tapılmadı və ya vaxtı bitib': { en: 'Story not found or expired', ru: 'История не найдена или истекла' },
  'Bu hekayə sizə aid deyil': { en: 'This story does not belong to you', ru: 'Эта история вам не принадлежит' },

  // ───── çat ─────
  'Söhbət tapılmadı': { en: 'Conversation not found', ru: 'Диалог не найден' },
  'Özünüzlə söhbət aça bilməzsiniz': { en: 'You cannot start a conversation with yourself', ru: 'Нельзя начать диалог с самим собой' },
  'Bu istifadəçi ilə yazışma mümkün deyil': { en: 'You cannot message this user', ru: 'Переписка с этим пользователем невозможна' },
  'Mesaj boş ola bilməz': { en: 'A message cannot be empty', ru: 'Сообщение не может быть пустым' },
  'Foto seçilməyib': { en: 'No photo selected', ru: 'Фото не выбрано' },
  'Kart üçün slug lazımdır': { en: 'A slug is required for the card', ru: 'Для карточки нужен slug' },

  // ───── məkan, check-in, gamification ─────
  'bbox formatı: minLng,minLat,maxLng,maxLat': { en: 'bbox format: minLng,minLat,maxLng,maxLat', ru: 'Формат bbox: minLng,minLat,maxLng,maxLat' },
  'Check-in üçün yerləşmə lazımdır — yerləşmə icazəsi verin': {
    en: 'Check-in requires your location — allow location access',
    ru: 'Для чек-ина нужна геопозиция — разрешите доступ к геопозиции',
  },
  'Bu məkanda bu gün artıq check-in etmisən': {
    en: 'You have already checked in at this place today',
    ru: 'Вы уже делали чек-ин в этом месте сегодня',
  },

  // ───── marşrut, səyahət ─────
  'Bu marşrut sizə aid deyil': { en: 'This route does not belong to you', ru: 'Этот маршрут вам не принадлежит' },
  'Dayanacaq tapılmadı': { en: 'Stop not found', ru: 'Остановка не найдена' },
  'Bəzi dayanacaqlar bu marşruta aid deyil': { en: 'Some stops do not belong to this route', ru: 'Некоторые остановки не относятся к этому маршруту' },
  'Format: 1, 2-3 və ya 7+': { en: 'Format: 1, 2-3 or 7+', ru: 'Формат: 1, 2-3 или 7+' },
  'Format: HH:MM': { en: 'Format: HH:MM', ru: 'Формат: ЧЧ:ММ' },
  'Səyahət tapılmadı': { en: 'Trip not found', ru: 'Поездка не найдена' },
  'Bu səyahət sizə aid deyil': { en: 'This trip does not belong to you', ru: 'Эта поездка вам не принадлежит' },
  'Bitmə tarixi başlanğıcdan əvvəl ola bilməz': { en: 'The end date cannot be before the start date', ru: 'Дата окончания не может быть раньше даты начала' },
  'Maksimum 60 gün': { en: 'Maximum 60 days', ru: 'Максимум 60 дней' },
  'Gün tapılmadı': { en: 'Day not found', ru: 'День не найден' },
  'type=custom üçün title tələb olunur': { en: 'title is required for type=custom', ru: 'Для type=custom требуется title' },
  'Element tapılmadı': { en: 'Item not found', ru: 'Элемент не найден' },
  'Bəzi elementlər bu səyahətə aid deyil': { en: 'Some items do not belong to this trip', ru: 'Некоторые элементы не относятся к этой поездке' },
  'Səyahət artıq tamamlanıb': { en: 'The trip has already been completed', ru: 'Поездка уже завершена' },
  'Ləğv edilmiş səyahət başladıla bilməz': { en: 'A cancelled trip cannot be started', ru: 'Отменённую поездку нельзя начать' },
  'Ləğv edilmiş səyahət tamamlana bilməz': { en: 'A cancelled trip cannot be completed', ru: 'Отменённую поездку нельзя завершить' },

  // ───── təcrübə ─────
  'Bu təcrübə sizə aid deyil': { en: 'This experience does not belong to you', ru: 'Это впечатление вам не принадлежит' },
  'Bəzi fotolar tapılmadı və ya sizə aid deyil': { en: 'Some photos were not found or do not belong to you', ru: 'Некоторые фото не найдены или вам не принадлежат' },
  'Təcrübə yaratmaq üçün Local Expert olmalısınız': { en: 'You must be a Local Expert to create an experience', ru: 'Чтобы создать впечатление, нужно быть Local Expert' },
  // "Yayımlamaq üçün tamamlanmalıdır: …" siyahısının elementləri (həm də `details`)
  'ən azı 1 foto': { en: 'at least 1 photo', ru: 'хотя бы 1 фото' },
  'təsvir (ən azı 20 simvol)': { en: 'description (at least 20 characters)', ru: 'описание (не менее 20 символов)' },
  'görüş yeri': { en: 'meeting point', ru: 'место встречи' },
  'qiymət': { en: 'price', ru: 'цена' },

  // ───── rezervasiya, ödəniş ─────
  'Seçilmiş tarix tapılmadı': { en: 'The selected date was not found', ru: 'Выбранная дата не найдена' },
  'Tarix seçilməlidir (slotId və ya startAt)': { en: 'A date must be selected (slotId or startAt)', ru: 'Нужно выбрать дату (slotId или startAt)' },
  'Keçmiş tarixə rezervasiya edilə bilməz': { en: 'You cannot book a date in the past', ru: 'Нельзя забронировать прошедшую дату' },
  'Rezervasiya tapılmadı': { en: 'Booking not found', ru: 'Бронирование не найдено' },
  'Bu rezervasiya sizə aid deyil': { en: 'This booking does not belong to you', ru: 'Это бронирование вам не принадлежит' },
  'Ləğv edilmiş rezervasiya ödənilə bilməz': { en: 'A cancelled booking cannot be paid', ru: 'Отменённое бронирование нельзя оплатить' },
  'Geri qaytarılmış rezervasiya ödənilə bilməz': { en: 'A refunded booking cannot be paid', ru: 'Бронирование с возвратом нельзя оплатить' },
  'Tamamlanmış rezervasiya ödənilə bilməz': { en: 'A completed booking cannot be paid', ru: 'Завершённое бронирование нельзя оплатить' },
  'Başlama vaxtı keçmiş rezervasiya ödənilə bilməz': {
    en: 'A booking whose start time has passed cannot be paid',
    ru: 'Нельзя оплатить бронирование, время начала которого уже прошло',
  },
  'Ödəniş alınmadı': { en: 'The payment failed', ru: 'Оплата не прошла' },
  'Rezervasiya ödəniş zamanı ləğv olundu — məbləğ kartınıza qaytarıldı': {
    en: 'The booking was cancelled during payment — the amount has been returned to your card',
    ru: 'Бронирование отменили во время оплаты — сумма возвращена на вашу карту',
  },
  'Rezervasiya artıq ləğv edilib': { en: 'The booking has already been cancelled', ru: 'Бронирование уже отменено' },
  'Tamamlanmış rezervasiya ləğv edilə bilməz': { en: 'A completed booking cannot be cancelled', ru: 'Завершённое бронирование нельзя отменить' },
  'Bilet yalnız təsdiqlənmiş rezervasiya üçün mövcuddur': {
    en: 'A ticket is only available for a confirmed booking',
    ru: 'Билет доступен только для подтверждённого бронирования',
  },
  'Ödəniş üsulu tapılmadı': { en: 'Payment method not found', ru: 'Способ оплаты не найден' },
  'Ödəniş sessiyası yoxdur': { en: 'There is no payment session', ru: 'Платёжная сессия отсутствует' },
  'Ödəniş sessiyası tapılmadı': { en: 'Payment session not found', ru: 'Платёжная сессия не найдена' },
  'Ödəniş tapılmadı': { en: 'Payment not found', ru: 'Платёж не найден' },
  'Yalnız uğurlu ödənişlər geri qaytarıla bilər': { en: 'Only successful payments can be refunded', ru: 'Вернуть можно только успешные платежи' },
  'Geri qaytarma alınmadı': { en: 'The refund failed', ru: 'Не удалось выполнить возврат' },
  'Kart nömrəsi yanlışdır': { en: 'Invalid card number', ru: 'Неверный номер карты' },
  'Kart nömrəsi 13–19 rəqəm olmalıdır': { en: 'The card number must be 13–19 digits', ru: 'Номер карты должен содержать 13–19 цифр' },
  'CVV 3–4 rəqəm olmalıdır': { en: 'CVV must be 3–4 digits', ru: 'CVV должен содержать 3–4 цифры' },
  'Webhook imzası yanlışdır': { en: 'Invalid webhook signature', ru: 'Неверная подпись вебхука' },
  // Ödəniş provayderinin səbəbləri — rezervasiyanın `payment.failureMessage` sahəsində də görünür
  'Kartda kifayət qədər vəsait yoxdur': { en: 'Insufficient funds on the card', ru: 'Недостаточно средств на карте' },
  'Kartın müddəti bitib': { en: 'The card has expired', ru: 'Срок действия карты истёк' },
  'Başqa ödəniş üsulu seçildi': { en: 'Another payment method was selected', ru: 'Выбран другой способ оплаты' },
  'Rezervasiya ləğv edildi': { en: 'The booking was cancelled', ru: 'Бронирование отменено' },
  'Ödəniş vaxtı bitdi': { en: 'The payment time expired', ru: 'Время на оплату истекло' },

  // ───── rəy ─────
  'Rəy tapılmadı': { en: 'Review not found', ru: 'Отзыв не найден' },
  'Bu rəy sizə aid deyil': { en: 'This review does not belong to you', ru: 'Этот отзыв вам не принадлежит' },
  'Bu obyekt üçün artıq rəy yazmısınız — redaktə edə bilərsiniz': {
    en: 'You have already reviewed this — you can edit your review',
    ru: 'Вы уже оставили отзыв об этом объекте — его можно отредактировать',
  },

  // ───── saxlanılanlar ─────
  'Kolleksiya tapılmadı': { en: 'Collection not found', ru: 'Коллекция не найдена' },
  'Bu adda kolleksiya artıq var': { en: 'A collection with this name already exists', ru: 'Коллекция с таким названием уже существует' },
  'Bu kolleksiya sizə aid deyil': { en: 'This collection does not belong to you', ru: 'Эта коллекция вам не принадлежит' },

  // ───── admin (panel az göndərir, amma API-ni mobil də çağıra bilər) ─────
  'Şikayət tapılmadı': { en: 'Report not found', ru: 'Жалоба не найдена' },
  'Bu şikayət artıq bağlanıb': { en: 'This report has already been closed', ru: 'Эта жалоба уже закрыта' },
  'Bu şikayətin müəllifi yoxdur — istifadəçi dayandırıla bilməz': {
    en: 'The reported content has no author — the user cannot be suspended',
    ru: 'У контента из жалобы нет автора — пользователя нельзя заблокировать',
  },
  'Admin hesabı dayandırıla bilməz': { en: 'An admin account cannot be suspended', ru: 'Аккаунт администратора нельзя заблокировать' },
  'Hesab onsuz da dayandırılıb': { en: 'The account is already suspended', ru: 'Аккаунт уже заблокирован' },
  'Hesab onsuz da aktivdir': { en: 'The account is already active', ru: 'Аккаунт уже активен' },
  'Bu kontent artıq silinib': { en: 'This content has already been removed', ru: 'Этот контент уже удалён' },
  'Kontent tapılmadı': { en: 'Content not found', ru: 'Контент не найден' },
};

type Render = (m: RegExpMatchArray) => string;

interface Template {
  re: RegExp;
  en: Render;
  ru: Render;
}

/** Vergüllə ayrılmış siyahının hər elementi ayrıca tərcümə olunur ("ən azı 1 foto, qiymət"). */
const list = (raw: string, lang: 'en' | 'ru'): string =>
  raw.split(', ').map((item) => EXACT_MESSAGES[item]?.[lang] ?? item).join(', ');

const seatsEn = (n: number) => `Only ${n} ${enPlural(n, 'spot', 'spots')} left on this date`;
const seatsRu = (n: number) => `На эту дату осталось только ${n} ${ruPlural(n, 'место', 'места', 'мест')}`;

/** Dəyişənli mesajlar. Sıra vacibdir — daha konkret şablon əvvəl gəlir. */
export const MESSAGE_TEMPLATES: Template[] = [
  // "<Obyekt> tapılmadı: <slug>"
  ...(
    [
      ['Məkan', 'Place', 'Место не найдено'],
      ['Marşrut', 'Route', 'Маршрут не найден'],
      ['Təcrübə', 'Experience', 'Впечатление не найдено'],
      ['Region', 'Region', 'Регион не найден'],
      ['Biznes', 'Business', 'Бизнес не найден'],
      ['Paket', 'Package', 'Пакет не найден'],
      ['Tədbir', 'Event', 'Событие не найдено'],
      ['Sənəd', 'Document', 'Документ не найден'],
      ['Local Expert', 'Local Expert', 'Local Expert не найден'],
    ] as const
  ).map(
    ([az, en, ru]): Template => ({
      re: new RegExp(`^${az} tapılmadı: (.+)$`, 's'),
      en: (m) => `${en} not found: ${m[1]}`,
      ru: (m) => `${ru}: ${m[1]}`,
    }),
  ),
  { re: /^Kateqoriya tapılmadı: (.+)$/s, en: (m) => `Category not found: ${m[1]}`, ru: (m) => `Категория не найдена: ${m[1]}` },
  { re: /^Tapılmadı: (.+)$/s, en: (m) => `Not found: ${m[1]}`, ru: (m) => `Не найдено: ${m[1]}` },
  {
    re: /^Media tapılmadı və ya yüklənməyib: (.+)$/s,
    en: (m) => `Media not found or not uploaded: ${m[1]}`,
    ru: (m) => `Медиафайлы не найдены или не загружены: ${m[1]}`,
  },
  {
    re: /^Bu əməliyyat üçün rol tələb olunur: (.+)$/s,
    en: (m) => `This action requires the role: ${m[1]}`,
    ru: (m) => `Для этого действия требуется роль: ${m[1]}`,
  },
  {
    re: /^(Google|Apple) token yoxlanmadı: (.*)$/s,
    en: (m) => `${m[1]} token verification failed: ${m[2]}`,
    ru: (m) => `Не удалось проверить токен ${m[1]}: ${m[2]}`,
  },
  { re: /^Bu tarixdə yalnız (\d+) yer qalıb$/, en: (m) => seatsEn(Number(m[1])), ru: (m) => seatsRu(Number(m[1])) },
  {
    re: /^Naməlum əlavə xidmət: (.+)$/s,
    en: (m) => `Unknown extra service: ${m[1]}`,
    ru: (m) => `Неизвестная дополнительная услуга: ${m[1]}`,
  },
  {
    re: /^Geri qaytarıla bilən maksimum məbləğ: (.+) AZN$/,
    en: (m) => `Maximum refundable amount: ${m[1]} AZN`,
    ru: (m) => `Максимальная сумма возврата: ${m[1]} AZN`,
  },
  {
    re: /^Check-in üçün məkana (\d+) m-dən yaxın olmalısınız \(hazırda ([\d.]+) km\)$/,
    en: (m) => `You must be within ${m[1]} m of the place to check in (currently ${m[2]} km away)`,
    ru: (m) => `Для чек-ина нужно находиться не дальше ${m[1]} м от места (сейчас ${m[2]} км)`,
  },
  {
    re: /^Marşrut (\d+) günlükdür — (\d+)-ci gün yoxdur$/,
    en: (m) => `The route is ${m[1]} ${enPlural(Number(m[1]), 'day', 'days')} long — there is no day ${m[2]}`,
    ru: (m) => `Маршрут рассчитан на ${m[1]} ${ruPlural(Number(m[1]), 'день', 'дня', 'дней')} — дня ${m[2]} нет`,
  },
  {
    re: /^Marşrutun (\d+)\. günündə dayanacaq var — gün sayını (\d+) etməzdən əvvəl onları başqa günə köçürün və ya silin$/,
    en: (m) => `Day ${m[1]} of the route has stops — move them to another day or delete them before changing the number of days to ${m[2]}`,
    ru: (m) => `На ${m[1]}-й день маршрута есть остановки — перенесите их на другой день или удалите, прежде чем менять число дней на ${m[2]}`,
  },
  {
    re: /^type=(.+) üçün slug tələb olunur$/,
    en: (m) => `slug is required for type=${m[1]}`,
    ru: (m) => `Для type=${m[1]} требуется slug`,
  },
  {
    re: /^Yayımlamaq üçün tamamlanmalıdır: (.+)$/s,
    en: (m) => `To publish, complete: ${list(m[1], 'en')}`,
    ru: (m) => `Для публикации нужно заполнить: ${list(m[1], 'ru')}`,
  },
  {
    re: /^Gələcək (\d+) rezervasiya var — əvvəlcə onları həll edin$/,
    en: (m) => `There ${enPlural(Number(m[1]), 'is', 'are')} ${m[1]} upcoming ${enPlural(Number(m[1]), 'booking', 'bookings')} — resolve ${enPlural(Number(m[1]), 'it', 'them')} first`,
    ru: (m) => `Есть предстоящие бронирования (${m[1]}) — сначала разберитесь с ними`,
  },
  {
    re: /^Fayl həddi aşır: maksimum (\d+) MB$/,
    en: (m) => `The file is too large: maximum ${m[1]} MB`,
    ru: (m) => `Файл слишком большой: максимум ${m[1]} МБ`,
  },
  {
    re: /^Bu fayl növü dəstəklənmir: (.*)$/s,
    en: (m) => `This file type is not supported: ${m[1]}`,
    ru: (m) => `Этот тип файла не поддерживается: ${m[1]}`,
  },
];

/**
 * class-validator və Nest-in ingiliscə defolt mesajları. Onlar az və en üçün
 * olduğu kimi qalır; rus dili üçün ən çox rast gəlinənlərin qarşılığı var.
 */
export const RU_DEFAULT_TEMPLATES: Array<{ re: RegExp; ru: Render }> = [
  { re: /^property (\S+) should not exist$/, ru: (m) => `Поле ${m[1]} не допускается` },
  { re: /^(\S+) must be longer than or equal to (\d+) characters$/, ru: (m) => `${m[1]}: не менее ${m[2]} символов` },
  { re: /^(\S+) must be shorter than or equal to (\d+) characters$/, ru: (m) => `${m[1]}: не более ${m[2]} символов` },
  { re: /^(\S+) should not be empty$/, ru: (m) => `${m[1]}: поле не должно быть пустым` },
  { re: /^(\S+) must be a string$/, ru: (m) => `${m[1]}: должно быть строкой` },
  { re: /^(\S+) must be an integer number$/, ru: (m) => `${m[1]}: должно быть целым числом` },
  { re: /^(\S+) must be a number conforming to the specified constraints$/, ru: (m) => `${m[1]}: должно быть числом` },
  { re: /^(\S+) must be a boolean value$/, ru: (m) => `${m[1]}: должно быть логическим значением` },
  { re: /^(\S+) must be an array$/, ru: (m) => `${m[1]}: должно быть массивом` },
  { re: /^(\S+) must be a valid ISO 8601 date string$/, ru: (m) => `${m[1]}: должно быть датой в формате ISO 8601` },
  { re: /^(\S+) must not be less than (-?[\d.]+)$/, ru: (m) => `${m[1]}: не меньше ${m[2]}` },
  { re: /^(\S+) must not be greater than (-?[\d.]+)$/, ru: (m) => `${m[1]}: не больше ${m[2]}` },
  { re: /^(\S+) must be one of the following values: (.*)$/s, ru: (m) => `${m[1]}: допустимые значения — ${m[2]}` },
  { re: /^(\S+) must be an email$/, ru: (m) => `${m[1]}: некорректный e-mail` },
  { re: /^ThrottlerException: Too Many Requests$/, ru: () => 'Слишком много запросов — повторите попытку позже' },
  { re: /^Cannot (GET|POST|PUT|PATCH|DELETE) (.+)$/, ru: (m) => `Путь не найден: ${m[1]} ${m[2]}` },
  { re: /^Forbidden resource$/, ru: () => 'Доступ запрещён' },
  { re: /^Unauthorized$/, ru: () => 'Требуется авторизация' },
];

/** Mesajı dilə çevirir. az üçün və tanınmayan mesaj üçün olduğu kimi qaytarır. */
export function translateMessage(message: string, lang: Lang): string {
  if (lang === 'az' || !message) return message;
  const exact = EXACT_MESSAGES[message];
  if (exact) return exact[lang];
  for (const t of MESSAGE_TEMPLATES) {
    const m = message.match(t.re);
    if (m) return t[lang](m);
  }
  if (lang === 'ru') {
    for (const t of RU_DEFAULT_TEMPLATES) {
      const m = message.match(t.re);
      if (m) return t.ru(m);
    }
  }
  return message;
}

/**
 * `details` — validasiya mesajlarının siyahısı (sətirlər) tərcümə olunur;
 * obyekt (məs. `{ seatsLeft }`) dəyişmir.
 */
export function translateDetails(details: unknown, lang: Lang): unknown {
  if (lang === 'az' || !Array.isArray(details)) return details;
  return details.map((d) => (typeof d === 'string' ? translateMessage(d, lang) : d));
}
