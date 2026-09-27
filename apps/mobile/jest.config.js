/**
 * Kontrakt testləri sırf şəbəkə sorğularıdır — React Native runtime lazım deyil,
 * ona görə `@react-native/jest-preset` əvəzinə sadə ts-jest konfiqurasiyası.
 * Komponent testləri əlavə olunanda ayrıca `projects` bölməsi yaradılacaq.
 */
// Tarix testləri Bakı vaxtı ilə işləyir — UTC+4-də gecə yarısı ətrafındakı
// `toISOString()` səhvi yalnız burada görünür. Worker-lər bu mühiti miras alır.
process.env.TZ = 'Asia/Baku';

module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
