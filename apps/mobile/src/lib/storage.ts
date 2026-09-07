import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Davamlı yaddaş. AsyncStorage native modul kimi artıq pod-larda qurulub.
 * Yalnız kiçik dəyərlər üçün — token, dil, onboarding vəziyyəti.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // yaddaş dolubsa əməliyyatı bloklamırıq
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* susdur */
    }
  },
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value));
  },
};

export const STORAGE_KEYS = {
  session: 'gezgin.session',
  language: 'gezgin.language',
} as const;
