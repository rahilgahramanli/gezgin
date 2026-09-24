import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';
import az from './az.json';
import en from './en.json';

/** Tərcüməsi olan dillər — `ru` əlavə olunanda bura da yazılmalıdır. */
const resources = { az: { translation: az }, en: { translation: en } };

/** Cihazın dili — `expo-localization` olmadan, native modullardan. */
function deviceLanguage(): string {
  const locale =
    Platform.OS === 'ios'
      ? (NativeModules.SettingsManager?.settings?.AppleLocale as string | undefined) ??
        (NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] as string | undefined)
      : (NativeModules.I18nManager?.localeIdentifier as string | undefined);
  const code = locale?.slice(0, 2).toLowerCase();
  return code && code in resources ? code : 'az';
}

const device = deviceLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: device,
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
});

export default i18n;
