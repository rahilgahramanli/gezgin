import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LEVEL_XP, TIERS, XP_RULES, PLATFORM_COMMISSION_RATE, CURRENCY, MEDIA } from '@gezgin/shared';

const LEGAL_DOCS: Record<string, { titleAz: string; version: string; url: string }> = {
  terms: { titleAz: 'İstifadə şərtləri', version: '1.0', url: 'https://gezgin.app/legal/terms' },
  privacy: { titleAz: 'Məxfilik siyasəti', version: '1.0', url: 'https://gezgin.app/legal/privacy' },
  'expert-terms': { titleAz: 'Local Expert şərtləri', version: '1.0', url: 'https://gezgin.app/legal/expert-terms' },
};

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

  legal(slug: string) {
    const doc = LEGAL_DOCS[slug];
    if (!doc) throw new NotFoundException({ message: `Sənəd tapılmadı: ${slug}` });
    return { slug, ...doc };
  }
}
