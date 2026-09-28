#!/usr/bin/env node
/**
 * i18n yoxlaması:
 *  1. Hər namespace-də az / en / ru açar dəstləri uyğundur (cəm şəkilçiləri nəzərə alınır:
 *     az `_other`, en `_one/_other`, ru `_one/_few/_many`).
 *  2. Koddakı `t('ns:key')` / `t('key')` (useT('ns') ilə) / `tp(...)` açarları az faylında var.
 *  3. (--literals <fayllar>) göstərilən fayllarda tərcüməsiz azərbaycanca mətn qalmayıb.
 *
 *   node scripts/i18n-check.js
 *   node scripts/i18n-check.js --literals src/screens/booking
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const LOC = path.join(ROOT, 'i18n', 'locales');
const LANGS = ['az', 'en', 'ru'];
const PLURAL = /_(one|few|many|other)$/;

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const load = (lang, ns) => JSON.parse(fs.readFileSync(path.join(LOC, lang, `${ns}.json`), 'utf8'));
const namespaces = fs.readdirSync(path.join(LOC, 'az')).map((f) => f.replace(/\.json$/, ''));

let problems = 0;
const report = (msg) => {
  problems += 1;
  console.log(`✗ ${msg}`);
};

// 1. açar dəstləri
const keys = {};
for (const ns of namespaces) {
  const sets = {};
  for (const lang of LANGS) sets[lang] = new Set(flatten(load(lang, ns)).map((k) => k.replace(PLURAL, '')));
  keys[ns] = sets.az;
  for (const lang of ['en', 'ru']) {
    for (const k of sets.az) if (!sets[lang].has(k)) report(`${lang}/${ns}.json: "${k}" yoxdur`);
    for (const k of sets[lang]) if (!sets.az.has(k)) report(`${lang}/${ns}.json: artıq açar "${k}" (az-da yoxdur)`);
  }
}

// 2. koddakı açarlar
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'i18n' ? [] : walk(p);
    return /\.(tsx?|js)$/.test(e.name) ? [p] : [];
  });

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const nsMatch = /useT\(\s*'([a-z]+)'\s*\)/.exec(src);
  const defaultNs = nsMatch ? nsMatch[1] : 'common';
  const re = /\b(?:t|tp|tr|tpr|i18n\.t)\(\s*'([^'$`]+)'/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1];
    if (!/^[a-zA-Z]/.test(raw) || raw.includes(' ')) continue;
    const [ns, key] = raw.includes(':') ? raw.split(':') : [defaultNs, raw];
    if (!keys[ns]) continue;
    if (!keys[ns].has(key.replace(PLURAL, ''))) report(`${path.relative(ROOT, file)}: açar tapılmadı "${ns}:${key}"`);
  }
}

// 3. tərcüməsiz literal mətn
const litIdx = process.argv.indexOf('--literals');
if (litIdx !== -1) {
  const targets = process.argv.slice(litIdx + 1).map((p) => path.resolve(process.cwd(), p));
  const files = targets.flatMap((p) => (fs.statSync(p).isDirectory() ? walk(p) : [p]));
  const AZ = /[əıöüşçğƏİÖÜŞÇĞ]/;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let inBlock = false;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('/*')) inBlock = true;
      if (inBlock) {
        if (trimmed.includes('*/')) inBlock = false;
        return;
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (line.includes('i18n-ignore')) return;
      const code = line
        // regex literalları (hərf qatlama, dil aşkarlama) mətn deyil
        .replace(/(^|[(,=:!&|?{};>]\s*)\/(?![/*])(?:\\.|\[[^\]]*\]|[^/\\\n[])+\/[gimsuy]*/g, '$1RE')
        .replace(/\/\/.*$/, '')
        .replace(/\{\/\*.*?\*\/\}/g, '');
      // Identifikatorlar ASCII-dir — kod sətrində istənilən azərbaycanca hərf tərcüməsiz
      // mətndir: literal, ayrıca sətirdə JSX mətni və ya `{n} baxış` kimi qarışıq hal
      if (AZ.test(code)) report(`${path.relative(ROOT, file)}:${i + 1}: tərcüməsiz mətn: ${trimmed.slice(0, 90)}`);
    });
  }
}

console.log(problems ? `\n${problems} problem` : '✓ i18n yoxlaması keçdi');
process.exit(problems ? 1 : 0);
