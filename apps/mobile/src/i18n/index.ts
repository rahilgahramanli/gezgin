import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import az from './az.json';
import en from './en.json';

/** Tərcüməsi olan dillər — `ru` əlavə olunanda bura da yazılmalıdır. */
const resources = { az: { translation: az }, en: { translation: en } };

/**
 * Tətbiqin əsas dili Azərbaycan dilidir — ingilis dilli iPhone-da (en_AZ) da
 * interfeys azərbaycanca açılır. İstifadəçinin seçimi `lib/language.ts`-də
 * saxlanılır və açılışda bərpa olunur.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: 'az',
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
});

export default i18n;
