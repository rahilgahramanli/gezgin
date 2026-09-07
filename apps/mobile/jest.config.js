/**
 * Kontrakt testləri sırf şəbəkə sorğularıdır — React Native runtime lazım deyil,
 * ona görə `@react-native/jest-preset` əvəzinə sadə ts-jest konfiqurasiyası.
 * Komponent testləri əlavə olunanda ayrıca `projects` bölməsi yaradılacaq.
 */
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
