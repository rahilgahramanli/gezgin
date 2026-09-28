import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXACT_MESSAGES, translateDetails, translateMessage } from './messages';

const AZ_CHARS = /[əıışçğöüİƏŞÇĞÖÜ]/;

describe('xəta mesajlarının kataloqu', () => {
  describe('dəqiq mesajlar', () => {
    it('en və ru tərcüməsini qaytarır', () => {
      expect(translateMessage('E-mail və ya şifrə yanlışdır', 'en')).toBe('Incorrect email or password');
      expect(translateMessage('E-mail və ya şifrə yanlışdır', 'ru')).toBe('Неверный e-mail или пароль');
      expect(translateMessage('Rezervasiya tapılmadı', 'ru')).toBe('Бронирование не найдено');
    });

    it('az üçün mətn toxunulmaz qalır', () => {
      for (const az of Object.keys(EXACT_MESSAGES)) expect(translateMessage(az, 'az')).toBe(az);
      expect(translateMessage('Məkan tapılmadı: lahic', 'az')).toBe('Məkan tapılmadı: lahic');
    });

    it('hər girişin həm en, həm ru tərcüməsi var və az-dan fərqlidir', () => {
      for (const [az, tr] of Object.entries(EXACT_MESSAGES)) {
        expect(tr.en.trim()).not.toBe('');
        expect(tr.ru.trim()).not.toBe('');
        // "Format: HH:MM" kimi dil-neytral mesajlar istisnadır
        if (AZ_CHARS.test(az)) {
          expect(tr.en).not.toBe(az);
          expect(tr.ru).not.toBe(az);
        }
      }
    });
  });

  describe('şablonlar', () => {
    it('obyekt adı + slug', () => {
      expect(translateMessage('Məkan tapılmadı: xinaliq', 'en')).toBe('Place not found: xinaliq');
      expect(translateMessage('Məkan tapılmadı: xinaliq', 'ru')).toBe('Место не найдено: xinaliq');
      expect(translateMessage('Marşrut tapılmadı: quba-daglar', 'ru')).toBe('Маршрут не найден: quba-daglar');
      expect(translateMessage('Local Expert tapılmadı: rustem.q', 'en')).toBe('Local Expert not found: rustem.q');
      expect(translateMessage('Kateqoriya tapılmadı: a, b', 'en')).toBe('Category not found: a, b');
      expect(translateMessage('Tapılmadı: place/yoxdur', 'ru')).toBe('Не найдено: place/yoxdur');
    });

    it('rəqəmli mesajlarda cəm forması', () => {
      expect(translateMessage('Bu tarixdə yalnız 1 yer qalıb', 'en')).toBe('Only 1 spot left on this date');
      expect(translateMessage('Bu tarixdə yalnız 8 yer qalıb', 'en')).toBe('Only 8 spots left on this date');
      expect(translateMessage('Bu tarixdə yalnız 1 yer qalıb', 'ru')).toBe('На эту дату осталось только 1 место');
      expect(translateMessage('Bu tarixdə yalnız 3 yer qalıb', 'ru')).toBe('На эту дату осталось только 3 места');
      expect(translateMessage('Bu tarixdə yalnız 11 yer qalıb', 'ru')).toBe('На эту дату осталось только 11 мест');
      expect(translateMessage('Marşrut 3 günlükdür — 5-ci gün yoxdur', 'en')).toBe('The route is 3 days long — there is no day 5');
      expect(translateMessage('Marşrut 1 günlükdür — 2-ci gün yoxdur', 'ru')).toBe('Маршрут рассчитан на 1 день — дня 2 нет');
    });

    it('check-in məsafəsi və məbləğ', () => {
      const az = 'Check-in üçün məkana 1000 m-dən yaxın olmalısınız (hazırda 12.3 km)';
      expect(translateMessage(az, 'en')).toBe('You must be within 1000 m of the place to check in (currently 12.3 km away)');
      expect(translateMessage(az, 'ru')).toBe('Для чек-ина нужно находиться не дальше 1000 м от места (сейчас 12.3 км)');
      expect(translateMessage('Geri qaytarıla bilən maksimum məbləğ: 42.5 AZN', 'en')).toBe('Maximum refundable amount: 42.5 AZN');
      expect(translateMessage('Naməlum əlavə xidmət: helikopter', 'ru')).toBe('Неизвестная дополнительная услуга: helikopter');
    });

    it('siyahı elementləri ayrıca tərcümə olunur', () => {
      const az = 'Yayımlamaq üçün tamamlanmalıdır: ən azı 1 foto, görüş yeri, qiymət';
      expect(translateMessage(az, 'en')).toBe('To publish, complete: at least 1 photo, meeting point, price');
      expect(translateMessage(az, 'ru')).toBe('Для публикации нужно заполнить: хотя бы 1 фото, место встречи, цена');
    });
  });

  describe('fallback', () => {
    it('tanınmayan mesaj olduğu kimi qalır', () => {
      expect(translateMessage('Tamamilə yeni xəta', 'en')).toBe('Tamamilə yeni xəta');
      expect(translateMessage('', 'ru')).toBe('');
    });

    it('class-validator-un ingiliscə defoltu en-də dəyişmir, ru-da tərcümə olunur', () => {
      const msg = 'fullName must be longer than or equal to 2 characters';
      expect(translateMessage(msg, 'en')).toBe(msg);
      expect(translateMessage(msg, 'ru')).toBe('fullName: не менее 2 символов');
      expect(translateMessage('property foo should not exist', 'ru')).toBe('Поле foo не допускается');
      expect(translateMessage('ThrottlerException: Too Many Requests', 'az')).toBe('ThrottlerException: Too Many Requests');
    });
  });

  describe('details', () => {
    it('sətir siyahısı tərcümə olunur, obyekt dəyişmir', () => {
      expect(translateDetails(['E-mail düzgün deyil', 'password must be a string'], 'ru')).toEqual([
        'Некорректный e-mail',
        'password: должно быть строкой',
      ]);
      const obj = { seatsLeft: 2 };
      expect(translateDetails(obj, 'en')).toBe(obj);
      const list = ['E-mail düzgün deyil'];
      expect(translateDetails(list, 'az')).toBe(list);
    });
  });

  /**
   * Mənbə kodundakı bütün xəta mesajları kataloqda olmalıdır — yeni
   * `throw new …Exception({ message: '…' })` tərcüməsiz qalmasın.
   * `${…}` ifadələri "7" ilə əvəz olunur (şablonlar rəqəm və ya sətir gözləyir).
   */
  describe('mənbə kodu ilə uyğunluq', () => {
    const SRC = join(__dirname, '..', '..');

    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return name === 'i18n' ? [] : files(p);
        return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
      });

    /** `start`-dakı açılan mötərizənin bağlandığı yer — sətir və şərhləri keçir. */
    function closing(src: string, start: number, open: string, close: string): number {
      let depth = 0;
      for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (c === "'" || c === '"' || c === '`') {
          i = skipString(src, i);
          continue;
        }
        if (c === '/' && src[i + 1] === '/') {
          i = src.indexOf('\n', i);
          continue;
        }
        if (c === open) depth++;
        if (c === close && --depth === 0) return i;
      }
      return src.length;
    }

    function skipString(src: string, i: number): number {
      const q = src[i];
      for (let j = i + 1; j < src.length; j++) {
        if (src[j] === '\\') {
          j++;
          continue;
        }
        if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
          j = closing(src, j + 1, '{', '}');
          continue;
        }
        if (src[j] === q) return j;
      }
      return src.length;
    }

    /** Seqmentdəki sətir literalları; şablon ifadələri "7" olur. */
    function literals(segment: string): string[] {
      const out: string[] = [];
      for (let i = 0; i < segment.length; i++) {
        const c = segment[i];
        if (c !== "'" && c !== '"' && c !== '`') continue;
        const end = skipString(segment, i);
        let body = segment.slice(i + 1, end);
        if (c === '`') {
          let res = '';
          for (let j = 0; j < body.length; j++) {
            if (body[j] === '$' && body[j + 1] === '{') {
              j = closing(body, j + 1, '{', '}');
              res += '7';
            } else res += body[j];
          }
          body = res;
        }
        out.push(body.replace(/\\'/g, "'"));
        i = end;
      }
      return out;
    }

    /** Xəta konteksti: exception çağırışları, socket rədd, ödənişin səbəbi, DTO mesajları. */
    function messagesIn(src: string): string[] {
      const found: string[] = [];
      const call = /(?:Exception|reject|voidOpenIntents)\(/g;
      for (let m = call.exec(src); m; m = call.exec(src)) {
        const open = m.index + m[0].length - 1;
        found.push(...literals(src.slice(open, closing(src, open, '(', ')') + 1)));
      }
      for (const m of src.matchAll(/(?:failureMessage|message):\s*('(?:[^'\\]|\\.)*')/g)) found.push(...literals(m[1]));
      // Status → səbəb xəritəsi (bookings: NOT_PAYABLE)
      for (const m of src.matchAll(/NOT_PAYABLE[^=]*=\s*\{/g)) {
        const open = (m.index ?? 0) + m[0].length - 1;
        found.push(...literals(src.slice(open, closing(src, open, '{', '}') + 1)));
      }
      // Yayım yoxlamasının siyahısı
      for (const m of src.matchAll(/missing\.push\(('(?:[^'\\]|\\.)*')\)/g)) found.push(...literals(m[1]));
      return found.filter((s) => AZ_CHARS.test(s));
    }

    const all = [...new Set(files(SRC).flatMap((f) => messagesIn(readFileSync(f, 'utf8'))))];

    it('mənbədə az xəta mesajları tapılır', () => {
      expect(all.length).toBeGreaterThan(100);
      expect(all).toContain('E-mail və ya şifrə yanlışdır');
      expect(all).toContain('Bu tarixdə yalnız 7 yer qalıb');
      expect(all).toContain('Token etibarsızdır');
      expect(all).toContain('Ləğv edilmiş rezervasiya ödənilə bilməz');
    });

    it.each(['en', 'ru'] as const)('hamısının %s tərcüməsi var', (lang) => {
      const missing = all.filter((msg) => translateMessage(msg, lang) === msg);
      expect(missing).toEqual([]);
    });
  });
});
