import { Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';

/** Təxmini paket ölçüsü: xəritə plitələri + məkan məlumatı + kiçik şəkillər. */
const MB_PER_PLACE = 0.4;
const BASE_TILES_MB = 24;

@Injectable()
export class OfflineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private estimateSizeMb(placeCount: number): number {
    return Math.round(BASE_TILES_MB + placeCount * MB_PER_PLACE);
  }

  /** Ekran 25 — yüklənmiş və mövcud regionlar. */
  async packages(userId: bigint) {
    const regions = await this.prisma.region.findMany({
      where: { parentId: { not: null } },
      include: {
        cover: { select: { storageKey: true } },
        translations: { where: { lang: 'az' }, select: { name: true } },
        offlinePkg: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    const downloads = await this.prisma.offlineDownload.findMany({
      where: { userId },
      select: { packageId: true, version: true, downloadedAt: true },
    });
    const byPackage = new Map(downloads.map((d) => [d.packageId.toString(), d]));

    const items = regions.map((r) => {
      const pkg = r.offlinePkg;
      const download = pkg ? byPackage.get(pkg.id.toString()) : undefined;
      const version = pkg?.version ?? 1;
      return {
        region: { slug: r.slug, name: r.translations[0]?.name ?? r.slug, coverUrl: this.url(r.cover?.storageKey) },
        placeCount: r.placeCount,
        sizeMb: pkg?.sizeMb || this.estimateSizeMb(r.placeCount),
        status: pkg?.status ?? 'available',
        version,
        downloaded: Boolean(download),
        downloadedAt: download?.downloadedAt ?? null,
        updateAvailable: Boolean(download && download.version < version),
      };
    });

    const downloadedItems = items.filter((i) => i.downloaded);
    return {
      storage: {
        usedMb: downloadedItems.reduce((n, i) => n + i.sizeMb, 0),
        quotaMb: 2048,
        downloadedCount: downloadedItems.length,
      },
      downloaded: downloadedItems,
      available: items.filter((i) => !i.downloaded),
    };
  }

  /**
   * Ekran 25 — paketin məzmunu. Mobil tərəf bunu yerli SQLite-a yazır,
   * xəritə plitələrini isə Mapbox offline API-si ilə ayrıca çəkir.
   */
  async manifest(regionSlug: string) {
    const region = await this.prisma.region.findFirst({
      where: { slug: regionSlug },
      include: { translations: { select: { lang: true, name: true } }, offlinePkg: true },
    });
    if (!region) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Region tapılmadı: ${regionSlug}` });

    const [places, routes] = await Promise.all([
      this.prisma.place.findMany({
        where: { regionId: region.id, deletedAt: null, status: 'published' },
        include: {
          translations: { select: { lang: true, name: true, description: true } },
          photos: {
            where: { media: { deletedAt: null } },
            include: { media: { select: { storageKey: true, blurhash: true } } },
            orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
          categories: { include: { category: { select: { slug: true } } } },
        },
      }),
      this.prisma.route.findMany({
        where: { regionId: region.id, deletedAt: null, status: 'published', visibility: { in: ['public', 'official'] } },
        include: {
          translations: { select: { lang: true, title: true } },
          stops: { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }], include: { place: { select: { slug: true } } } },
        },
      }),
    ]);

    // Xəritə plitələri üçün əhatə sərhədi
    const lats = places.map((p) => Number(p.lat));
    const lngs = places.map((p) => Number(p.lng));
    const bbox = lats.length
      ? { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) }
      : null;

    return {
      region: {
        slug: region.slug,
        name: region.translations.find((t) => t.lang === 'az')?.name ?? region.slug,
        lat: region.lat === null ? null : Number(region.lat),
        lng: region.lng === null ? null : Number(region.lng),
      },
      version: region.offlinePkg?.version ?? 1,
      generatedAt: new Date(),
      bbox,
      estimatedSizeMb: region.offlinePkg?.sizeMb || this.estimateSizeMb(places.length),
      places: places.map((p) => ({
        slug: p.slug,
        name: p.translations.find((t) => t.lang === 'az')?.name ?? p.slug,
        description: p.translations.find((t) => t.lang === 'az')?.description ?? null,
        lat: Number(p.lat),
        lng: Number(p.lng),
        altitudeM: p.altitudeM,
        rating: Number(p.ratingAvg),
        categories: p.categories.map((c) => c.category.slug),
        imageUrl: this.url(p.photos[0]?.media.storageKey),
        blurhash: p.photos[0]?.media.blurhash ?? null,
      })),
      routes: routes.map((r) => ({
        slug: r.slug,
        title: r.translations.find((t) => t.lang === 'az')?.title ?? r.slug,
        days: r.days,
        distanceKm: r.distanceKm === null ? null : Number(r.distanceKm),
        difficulty: r.difficulty,
        stops: r.stops.map((s) => ({ day: s.dayNumber, order: s.sortOrder, place: s.place.slug, arriveTime: s.arriveTime })),
      })),
    };
  }

  /** Yükləməni qeydə alır — ekran 25 "Yenilənmə var" göstəricisi bundan asılıdır. */
  async markDownloaded(userId: bigint, regionSlug: string) {
    const region = await this.prisma.region.findFirst({
      where: { slug: regionSlug },
      include: { offlinePkg: true },
    });
    if (!region) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Region tapılmadı: ${regionSlug}` });

    const pkg =
      region.offlinePkg ??
      (await this.prisma.offlinePackage.create({
        data: {
          regionId: region.id,
          placeCount: region.placeCount,
          sizeMb: this.estimateSizeMb(region.placeCount),
          builtAt: new Date(),
        },
      }));

    await this.prisma.offlineDownload.upsert({
      where: { packageId_userId: { packageId: pkg.id, userId } },
      update: { version: pkg.version, downloadedAt: new Date() },
      create: { packageId: pkg.id, userId, version: pkg.version },
    });

    return { downloaded: true, region: region.slug, version: pkg.version, sizeMb: pkg.sizeMb };
  }

  async removeDownload(userId: bigint, regionSlug: string) {
    const region = await this.prisma.region.findFirst({ where: { slug: regionSlug }, include: { offlinePkg: true } });
    if (!region?.offlinePkg) return { downloaded: false };
    await this.prisma.offlineDownload.deleteMany({ where: { packageId: region.offlinePkg.id, userId } });
    return { downloaded: false };
  }
}
