import { TIERS } from '@gezgin/shared';
import { daysText, levelText, ruPlural } from './format';
import { badgeText, tierName, tierNameFromRow, xpNoteText, xpRuleName } from './gamification';
import { cancellationLabel, categoryName, priceLineLabel, titleFor } from './labels';
import { currentLang, parseLang, runWithLang } from './lang';

describe('dil konteksti', () => {
  it('Accept-Language-dən dil', () => {
    expect(parseLang(undefined)).toBe('az');
    expect(parseLang('*')).toBe('az');
    expect(parseLang('en-US,en;q=0.9')).toBe('en');
    expect(parseLang('RU')).toBe('ru');
    expect(parseLang('fr-FR')).toBe('az');
  });

  it('sorğudan kənarda az, kontekstdə verilən dil', () => {
    expect(currentLang()).toBe('az');
    expect(runWithLang('ru', () => currentLang())).toBe('ru');
    expect(runWithLang('en', () => tierName(TIERS[1]))).toBe('Explorer');
  });
});

describe('gamification adları', () => {
  it('tier — obyekt, kod və ya az adı ilə', () => {
    expect(tierName(TIERS[0], 'ru')).toBe('Новичок');
    expect(tierName('kesfci', 'ru')).toBe('Первооткрыватель');
    expect(tierName('Səyyah', 'en')).toBe('Traveler');
    expect(tierName('Gezgin', 'ru')).toBe('Gezgin');
    expect(tierName(TIERS[2], 'az')).toBe('Səyyah');
    expect(tierNameFromRow({ tierCode: 'kesf_eden', tierNameAz: 'Kəşf edən', tierNameEn: 'Explorer' }, 'az')).toBe('Kəşf edən');
    expect(tierNameFromRow({ tierCode: 'kesf_eden', tierNameAz: 'Kəşf edən', tierNameEn: 'Explorer' }, 'ru')).toBe('Исследователь');
  });

  it('XP qaydası və tarixçə qeydi', () => {
    expect(xpRuleName('place_checkin', 'az')).toBe('Məkanı kəşf et');
    expect(xpRuleName('review_written', 'en')).toBe('Write a review');
    expect(xpRuleName('naməlum', 'ru')).toBe('naməlum');
    expect(xpNoteText('Gündəlik limit dolub', 'en')).toBe('Daily limit reached');
    expect(xpNoteText('GZ-ABC123 ləğv edildi', 'ru')).toBe('GZ-ABC123 отменено');
    expect(xpNoteText('Lahıc', 'en')).toBe('Lahıc');
  });

  it('badge — az bazadan, digər dillər cədvəldən', () => {
    const row = { slug: 'ilk-zirve', nameAz: 'İlk Zirvə', nameEn: 'First Summit', descriptionAz: '10 məkan kəşf et' };
    expect(badgeText(row, 'az')).toEqual({ name: 'İlk Zirvə', description: '10 məkan kəşf et' });
    expect(badgeText(row, 'en')).toEqual({ name: 'First Summit', description: 'Discover 10 places' });
    expect(badgeText(row, 'ru')).toEqual({ name: 'Первая вершина', description: 'Откройте 10 мест' });
    expect(badgeText({ slug: 'yeni', nameAz: 'Yeni', nameEn: 'New', descriptionAz: 'x' }, 'en')).toEqual({ name: 'New', description: 'x' });
  });
});

describe('rezervasiya və digər mətnlər', () => {
  it('qiymət sətri koda görə', () => {
    expect(priceLineLabel('adult', 'Böyük', 'az')).toBe('Böyük');
    expect(priceLineLabel('adult', 'Böyük', 'ru')).toBe('Взрослый');
    expect(priceLineLabel('child', 'Uşaq (50% endirim)', 'en')).toBe('Child (50% off)');
    expect(priceLineLabel('package', '2 gecə / 3 gün', 'en')).toBe('2 nights / 3 days');
    expect(priceLineLabel('package', '1 gecə / 1 gün', 'ru')).toBe('1 ночь / 1 день');
    expect(priceLineLabel('spa', 'Spa paketi', 'ru')).toBe('Спа-пакет');
    expect(priceLineLabel('naməlum', 'Nəsə', 'en')).toBe('Nəsə');
  });

  it('ləğv siyasəti', () => {
    expect(cancellationLabel(48, 'x', 'en')).toBe('More than 48 hours left — full refund');
    expect(cancellationLabel(0, 'x', 'az')).toBe('24 saatdan az qalıb — geri qaytarma yoxdur');
    expect(cancellationLabel(12, 'x', 'ru')).toBe('x');
  });

  it('kateqoriya, təcrübə başlığı, gün və level', () => {
    expect(categoryName({ nameAz: 'Dağ', nameEn: 'Mountain', nameRu: 'Горы' }, 'ru')).toBe('Горы');
    expect(categoryName({ nameAz: 'Dağ', nameEn: '', nameRu: null }, 'en')).toBe('Dağ');
    expect(titleFor({ titleAz: 'Dağ yürüşü', titleEn: 'Mountain hike' }, 'en')).toBe('Mountain hike');
    expect(titleFor({ titleAz: 'Dağ yürüşü', titleEn: null }, 'en')).toBe('Dağ yürüşü');
    expect(titleFor({ titleAz: 'Dağ yürüşü', titleEn: 'Mountain hike' }, 'ru')).toBe('Dağ yürüşü');
    expect(daysText(1, 'en')).toBe('1 day');
    expect(daysText(22, 'ru')).toBe('22 дня');
    expect(daysText(3, 'az')).toBe('3 gün');
    expect(levelText(7, 'ru')).toBe('Уровень 7');
    expect(ruPlural(111, 'a', 'b', 'c')).toBe('c');
  });
});
