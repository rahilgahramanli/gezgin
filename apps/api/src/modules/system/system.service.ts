import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LEVEL_XP, TIERS, XP_RULES, PLATFORM_COMMISSION_RATE, CURRENCY, MEDIA } from '@gezgin/shared';

import { LEGAL_DOCS } from './legal-content';

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async health() {
    const started = Date.now();
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      uptimeS: Math.round(process.uptime()),
      checks: { database: db },
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    };
  }

  /** Mobil tətbiq açılışda bunu çəkir — sabitlər hardcode edilmir. */
  async appConfig() {
    const settings = await this.prisma.appSetting.findMany({ where: { isPublic: true } });
    const flags = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return {
      currency: CURRENCY,
      languages: ['az', 'en', 'ru'],
      defaultLanguage: 'az',
      platformCommissionRate: PLATFORM_COMMISSION_RATE,
      gamification: {
        maxLevel: LEVEL_XP.length,
        levelXp: LEVEL_XP,
        tiers: TIERS,
        xpRules: XP_RULES,
      },
      media: { imageMaxBytes: MEDIA.imageMaxBytes, videoMaxBytes: MEDIA.videoMaxBytes, sizes: MEDIA.sizes },
      payments: {
        provider: this.config.get<string>('PAYMENT_PROVIDER'),
        isMock: this.config.get<string>('PAYMENT_PROVIDER') === 'mock',
      },
      maps: { provider: 'mapbox', hasToken: Boolean(this.config.get<string>('MAPBOX_TOKEN')) },
      featureFlags: flags,
    };
  }

  async categories(type?: string) {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true, ...(type ? { types: { contains: type } } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map((c) => ({
      slug: c.slug,
      name: { az: c.nameAz, en: c.nameEn, ru: c.nameRu },
      icon: c.icon,
      types: c.types.split('|'),
    }));
  }

  appVersion() {
    return {
      minimumVersion: '1.0.0',
      latestVersion: '1.0.0',
      forceUpdate: false,
      storeUrl: {
        ios: 'https://apps.apple.com/app/gezgin/id000000000',
        android: 'https://play.google.com/store/apps/details?id=app.gezgin',
      },
    };
  }

  legal(slug: string, url: string) {
    const doc = LEGAL_DOCS[slug];
    if (!doc) throw new NotFoundException({ message: `Sənəd tapılmadı: ${slug}` });
    return { slug, ...doc, url };
  }

  legalHtml(slug: string): string {
    const doc = LEGAL_DOCS[slug];
    if (!doc) throw new NotFoundException({ message: `Sənəd tapılmadı: ${slug}` });
    const sections = doc.sections
      .map((s) => `<h2>${escapeHtml(s.heading)}</h2>${s.body.split('\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('')}`)
      .join('');
    return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.titleAz)} — GEZGIN</title><style>body{font:16px/1.6 -apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1b2a28;background:#faf8f4}h1{font-size:26px}h2{font-size:18px;margin-top:28px}.meta{color:#6b7a77;font-size:14px}</style></head><body><h1>${escapeHtml(doc.titleAz)}</h1><p class="meta">Versiya ${doc.version} · ${doc.updatedAt}</p>${sections}</body></html>`;
  }
}
