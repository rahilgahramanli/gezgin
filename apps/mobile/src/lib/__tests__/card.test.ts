import { cardTitle, formatCardNumber, formatExpiry, validateCard } from '@/lib/card';

const NOW = new Date(2026, 8, 28); // 28 sentyabr 2026

const valid = { number: '4111 1111 1111 1111', expiry: '12/29', cvc: '123', holderName: '' };

describe('kart forması', () => {
  it('nömrəni 4-lük qruplarla göstərir, rəqəm olmayanı atır', () => {
    expect(formatCardNumber('4111-1111 1111x1111')).toBe('4111 1111 1111 1111');
    expect(formatCardNumber('41111')).toBe('4111 1');
    expect(formatCardNumber('1'.repeat(25)).replace(/ /g, '')).toHaveLength(19);
  });

  it('bitmə tarixini AA/İİ kimi qurur', () => {
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('12')).toBe('12');
    expect(formatExpiry('1229')).toBe('12/29');
    expect(formatExpiry('12/2')).toBe('12/2');
  });

  it('düzgün kartdan API yükü qurur', () => {
    const { errors, payload } = validateCard({ ...valid, holderName: '  Aysel Məmmədova ' }, NOW);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      number: '4111111111111111', expMonth: 12, expYear: 2029, cvv: '123', holderName: 'Aysel Məmmədova',
    });
  });

  it('boş ad göndərilmir', () => {
    expect(validateCard(valid, NOW).payload).not.toHaveProperty('holderName');
  });

  it('nömrə uzunluğunu yoxlayır', () => {
    expect(validateCard({ ...valid, number: '4111 1111 111' }, NOW).errors.number).toBe(
      'Kart nömrəsi 13–19 rəqəm olmalıdır',
    );
    expect(validateCard({ ...valid, number: '' }, NOW).errors.number).toBe('Kart nömrəsini daxil edin');
  });

  it('ayı və keçmiş tarixi rədd edir', () => {
    expect(validateCard({ ...valid, expiry: '13/29' }, NOW).errors.expiry).toBe('Ay 01–12 arasında olmalıdır');
    expect(validateCard({ ...valid, expiry: '00/29' }, NOW).errors.expiry).toBe('Ay 01–12 arasında olmalıdır');
    expect(validateCard({ ...valid, expiry: '08/26' }, NOW).errors.expiry).toBe('Kartın müddəti bitib');
    // Cari ayın sonuna qədər etibarlıdır
    expect(validateCard({ ...valid, expiry: '09/26' }, NOW).errors.expiry).toBeUndefined();
    expect(validateCard({ ...valid, expiry: '1229' }, NOW).errors.expiry).toBe('Tarixi AA/İİ formatında yazın');
  });

  it('CVC 3–4 rəqəmdir', () => {
    expect(validateCard({ ...valid, cvc: '12' }, NOW).errors.cvc).toBe('CVC 3–4 rəqəm olmalıdır');
    expect(validateCard({ ...valid, cvc: '1234' }, NOW).errors.cvc).toBeUndefined();
  });

  it('kart başlığı marka və son 4 rəqəmdir', () => {
    expect(cardTitle({ brand: 'visa', last4: '4242' })).toBe('VISA •••• 4242');
  });
});
