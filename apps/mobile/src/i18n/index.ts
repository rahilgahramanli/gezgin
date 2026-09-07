import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';

/** Cihazın dili — `expo-localization` olmadan, native modullardan. */
function deviceLanguage(): string {
  const locale =
    Platform.OS === 'ios'
      ? (NativeModules.SettingsManager?.settings?.AppleLocale as string | undefined) ??
        (NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] as string | undefined)
      : (NativeModules.I18nManager?.localeIdentifier as string | undefined);
  const code = locale?.slice(0, 2).toLowerCase();
  return code === 'en' || code === 'ru' ? code : 'az';
}
import az from './az.json';
import en from './en.json';

const device = deviceLanguage();

void i18n.use(initReactI18next).init({
  resources: { az: { translation: az }, en: { translation: en } },
  lng: ['az', 'en', 'ru'].includes(device) ? device : 'az',
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
});

export default i18n;
