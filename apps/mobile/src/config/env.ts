import { Platform } from 'react-native';

/**
 * Mühit konfiqurasiyası.
 *
 * Expo-dan CLI-ə keçdiyimiz üçün `expo-constants` yoxdur — dəyərlər burada
 * saxlanılır. Prod buraxılışında `react-native-config` ilə `.env`-dən
 * oxunacaq; hazırda dev üçün sabitdir.
 *
 * Android emulyatorunda `localhost` cihazın özüdür — host maşına `10.0.2.2`
 * ilə çıxılır. iOS simulyatoru host şəbəkəsini paylaşır.
 */
const DEV_HOST = Platform.select({ android: '10.0.2.2', default: 'localhost' });

export const env = {
  apiUrl: __DEV__ ? `http://${DEV_HOST}:3100/api/v1` : 'https://api.gezgin.app/api/v1',
  isDev: __DEV__,
} as const;
