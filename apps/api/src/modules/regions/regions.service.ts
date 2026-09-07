import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';

type Lang = 'az' | 'en' | 'ru';

@Injectable()
export class RegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  /** Tərcümə seçimi: istənilən dil yoxdursa AZ-yə düşür. */
  private pick<T extends { lang: string }>(rows: T[], lang: Lang): T | undefined {
    return rows.find((r) => r.lang === lang) ?? rows.find((r) => r.lang === 'az') ?? rows[0];
  }

  async list(lang: Lang, featuredOnly = false) {
    const regions = await this.prisma.region.findMany({
      where: { parentId: { not: null }, ...(featuredOnly ? { isFeatured: true } : {}) },
      include: {
        translations: { select: { lang: true, name: true, description: true } },
        cover: { select: { storageKey: true, blurhash: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    });

    return regions.map((r) => {
      const t = this.pick(r.translations, lang);
      return {
        slug: r.slug,
        name: t?.name ?? r.slug,
        lat: r.lat,
        lng: r.lng,
        placeCount: r.placeCount,
        isFeatured: r.isFeatured,
        coverUrl: this.url(r.cover?.storageKey),
        blurhash: r.cover?.blurhash ?? null,
      };
    });
  }

  async detail(slug: string, lang: Lang) {
    const region = await this.prisma.region.findFirst({
      where: { slug },
      include: {
        translations: { select: { lang: true, name: true, description: true } },
        cover: { select: { storageKey: true, blurhash: true } },
        parent: { select: { slug: true, translations: { where: { lang: 'az' }, select: { name: true } } } },
      },
    });
    if (!region) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Region tapılmadı: ${slug}` });

    const t = this.pick(region.translations, lang);
    const [placeCount, routeCount, experienceCount, eventCount] = await Promise.all([
      this.prisma.place.count({ where: { regionId: region.id, deletedAt: null, status: 'published' } }),
      this.prisma.route.count({ where: { regionId: region.id, deletedAt: null, status: 'published' } }),
      this.prisma.experience.count({ where: { regionId: region.id, deletedAt: null, status: 'published' } }),
      this.prisma.event.count({ where: { regionId: region.id, deletedAt: null, endDate: { gte: new Date() } } }),
    ]);

    return {
      slug: region.slug,
      name: t?.name ?? region.slug,
      description: t?.description ?? null,
      lat: region.lat,
      lng: region.lng,
      coverUrl: this.url(region.cover?.storageKey),
      blurhash: region.cover?.blurhash ?? null,
      parent: region.parent
        ? { slug: region.parent.slug, name: region.parent.translations[0]?.name ?? region.parent.slug }
        : null,
      counts: { places: placeCount, routes: routeCount, experiences: experienceCount, upcomingEvents: eventCount },
    };
  }

  /** Ekran 32 — xəritədə region nöqtələri. */
  async mapPoints(lang: Lang) {
    const regions = await this.prisma.region.findMany({
      where: { parentId: { not: null }, lat: { not: null }, lng: { not: null } },
      include: { translations: { select: { lang: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return regions.map((r) => ({
      slug: r.slug,
      name: this.pick(r.translations, lang)?.name ?? r.slug,
      lat: r.lat,
      lng: r.lng,
      placeCount: r.placeCount,
    }));
  }
}
