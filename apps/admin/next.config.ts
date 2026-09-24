import type { NextConfig } from 'next';

const config: NextConfig = {
  // Docker image-i üçün minimal runtime — bütün node_modules köçürülmür
  output: 'standalone',
  outputFileTracingRoot: '../../',
  // Panel monorepo daxilindədir — `@gezgin/shared` mənbədən transpile olunur
  transpilePackages: ['@gezgin/shared'],
  // DİQQƏT: `env` bloku dəyəri build zamanı koda yazır — image başqa maşında
  // qurulduğu üçün konteynerdəki dəyişən oxunmurdu. Server komponentləri
  // `process.env`-i işləmə zamanı özləri oxuyur, ona görə burada elan edilmir.
};

export default config;
