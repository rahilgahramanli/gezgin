import { translateNotification } from './notifications';

const n = (type: string, title: string, body: string | null = null) => ({ type, title, body });

describe('bildirişlərin tərcüməsi', () => {
  it('az üçün saxlanılan mətn olduğu kimi qalır', () => {
    const row = n('level_up', 'Yeni səviyyə: Level 6 · Kəşf edən', '+300 XP');
    expect(translateNotification(row, 'az')).toEqual({ title: row.title, body: row.body });
  });

  it('bəyənmə, izləmə', () => {
    expect(translateNotification(n('social_like', 'Tural paylaşımını bəyəndi'), 'en').title).toBe('Tural liked your post');
    expect(translateNotification(n('social_like', 'Tural paylaşımını bəyəndi'), 'ru').title).toBe('Tural оценил(а) вашу публикацию');
    expect(translateNotification(n('social_follow', 'Aysel səni izləməyə başladı'), 'en').title).toBe('Aysel started following you');
    expect(translateNotification(n('social_follow', 'Kimsə səni izləməyə başladı'), 'ru').title).toBe('Кто-то подписался(-ась) на вас');
  });

  it('şərh və cavab — önizləmə dəyişmir', () => {
    expect(translateNotification(n('social_comment', 'Kamran şərh yazdı: "Möhtəşəm yerdir!"'), 'en').title).toBe(
      'Kamran commented: "Möhtəşəm yerdir!"',
    );
    expect(translateNotification(n('social_comment', 'Kamran şərhinə cavab yazdı: "Razıyam"'), 'ru').title).toBe(
      'Kamran ответил(а) на ваш комментарий: "Razıyam"',
    );
    // Başlıq 190 simvolda kəsilibsə bağlanan dırnaq olmur
    expect(translateNotification(n('social_comment', 'Kamran şərh yazdı: "Uzun mətn…'), 'en').title).toBe(
      'Kamran commented: "Uzun mətn…',
    );
  });

  it('yeni səviyyə — tier adı da tərcümə olunur, gövdə eyni qalır', () => {
    const row = n('level_up', 'Yeni səviyyə: Level 12 · Kəşf edən', '+800 XP');
    expect(translateNotification(row, 'en')).toEqual({ title: 'New level: Level 12 · Explorer', body: '+800 XP' });
    expect(translateNotification(row, 'ru')).toEqual({ title: 'Новый уровень: Уровень 12 · Исследователь', body: '+800 XP' });
  });

  it('yeni badge — ad və təsvir', () => {
    const row = n('badge_earned', 'Yeni badge: İlk Addım 🎉', 'İlk check-in');
    expect(translateNotification(row, 'en')).toEqual({ title: 'New badge: First Step 🎉', body: 'Your first check-in' });
    expect(translateNotification(row, 'ru')).toEqual({ title: 'Новое достижение: Первый шаг 🎉', body: 'Первый чек-ин' });
  });

  it('tanınmayan mətn dəyişmir', () => {
    const row = n('system', 'GEZGIN yeniləndi', 'Yeni funksiyalar');
    expect(translateNotification(row, 'en')).toEqual({ title: row.title, body: row.body });
    const badge = n('badge_earned', 'Yeni badge: Naməlum 🎉', 'Nəsə et');
    expect(translateNotification(badge, 'en')).toEqual({ title: 'New badge: Naməlum 🎉', body: 'Nəsə et' });
  });
});
