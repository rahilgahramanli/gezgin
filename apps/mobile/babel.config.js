/**
 * Babel konfiqurasiyası.
 *
 * `@react-native/metro-babel-transformer` bu faylı tapanda onu `extends` kimi
 * yükləyir və transform etdiyi BÜTÜN fayllara tətbiq edir — o cümlədən
 * monorepo kökündəki hoisted `node_modules/react-native`-ə. Ona görə konfiqurasiya
 * burada qalır; kökə qoymaq lazım deyil.
 */
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      // `@/…` idxalları — tsconfig-dəki `paths` ilə eyni
      'module-resolver',
      {
        root: [__dirname + '/src'],
        alias: { '@': __dirname + '/src' },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};
