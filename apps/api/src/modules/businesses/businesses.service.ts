import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { toBooleanQuery } from '@/common/search/normalize';

type Lang = 'az' | 'en' | 'ru';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  async list(opts: { q?: string; region?: string; type?: string; offset?: number; limit?: number }, lang: Lang) {
    const where: Prisma.BusinessWhereInput = {
      deletedAt: null,
      status: 'published',
      ...(opts.region ? { region: { slug: opts.region } } : {}),
      ...(opts.type ? { type: opts.type as Prisma.EnumBusinessTypeFilter['equals'] } : {}),
    };

    if (opts.q) {
      const bq = toBooleanQuery(opts.q);
      if (bq) {
        const ids = await this.prisma.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM businesses WHERE MATCH(search_text) AGAINST(${bq} IN BOOLEAN MODE) LIMIT 100
        `;
        where.id = { in: ids.map((i) => i.id) };
      } else {
        where.id = { in: [] };
      }
    }

    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;

    const rows = await this.prisma.business.findMany({
      where,
      orderBy: [{ isVerified: 'desc' }, { ratingAvg: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: {
        region: { include: { translations: { select: { lang: true, name: true } } } },
        cover: { select: { storageKey: true, blurhash: true } },
        _count: { select: { packages: true } },
      },
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((b) => {
        const rt = b.region.translations.find((x) => x.lang === lang) ?? b.region.translations.find((x) => x.lang === 'az');
        return {
          slug: b.slug,
          name: b.name,
          type: b.type,
          rating: Number(b.ratingAvg),
          ratingCount: b.ratingCount,
          isVerified: b.isVerified,
          packageCount: b._count.packages,
          region: { slug: b.region.slug, name: rt?.name ?? b.region.slug },
          coverUrl: this.url(b.cover?.storageKey),
          blurhash: b.cover?.blurhash ?? null,
        };
      }),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 22 — biznes profili. */
  async detail(slug: string, lang: Lang) {
    const b = await this.prisma.business.findFirst({
      where: { slug, deletedAt: null },
      include: {
        region: { include: { translations: { select: { lang: true, name: true } } } },
        cover: { select: { storageKey: true, blurhash: true } },
        logo: { select: { storageKey: true } },
        packages: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        photos: {
          where: { media: { deletedAt: null } },
          include: { media: { select: { storageKey: true, blurhash: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!b) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Biznes tapılmadı: ${slug}` });

    const rt = b.region.translations.find((x) => x.lang === lang) ?? b.region.translations.find((x) => x.lang === 'az');
    const reviewCount = await this.prisma.review.count({
      where: { targetType: 'business', targetId: b.id, deletedAt: null, isVisible: true },
    });

    return {
      slug: b.slug,
      name: b.name,
      type: b.type,
      description: b.descriptionAz,
      services: b.services ? b.services.split('|') : [],
      rating: Number(b.ratingAvg),
      ratingCount: b.ratingCount,
      reviewCount,
      isVerified: b.isVerified,
      phone: b.phone,
      website: b.website,
      address: b.address,
      lat: b.lat === null ? null : Number(b.lat),
      lng: b.lng === null ? null : Number(b.lng),
      region: { slug: b.region.slug, name: rt?.name ?? b.region.slug },
      coverUrl: this.url(b.cover?.storageKey),
      logoUrl: this.url(b.logo?.storageKey),
      photoCount: b.photos.length,
      photos: b.photos.slice(0, 12).map((p) => ({
        url: this.url(p.media.storageKey),
        blurhash: p.media.blurhash,
      })),
      packages: b.packages.map((p) => ({
        publicId: p.publicId,
        title: p.titleAz,
        description: p.descriptionAz,
        nights: p.nights,
        days: p.days,
        priceAzn: Number(p.priceAzn),
        includes: p.includes ? p.includes.split('|') : [],
      })),
    };
  }

  async packages(slug: string) {
    const b = await this.prisma.business.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!b) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Biznes tapılmadı: ${slug}` });

    const rows = await this.prisma.businessPackage.findMany({
      where: { businessId: b.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return rows.map((p) => ({
      publicId: p.publicId,
      title: p.titleAz,
      description: p.descriptionAz,
      nights: p.nights,
      days: p.days,
      priceAzn: Number(p.priceAzn),
      pricePerNightAzn: p.nights > 0 ? Math.round((Number(p.priceAzn) / p.nights) * 100) / 100 : null,
      includes: p.includes ? p.includes.split('|') : [],
      business: { slug, name: b.name },
    }));
  }

  async photos(slug: string, offset = 0, limit = 30) {
    const b = await this.prisma.business.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!b) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Biznes tapılmadı: ${slug}` });

    const rows = await this.prisma.businessPhoto.findMany({
      where: { businessId: b.id, media: { deletedAt: null } },
      include: { media: { select: { storageKey: true, blurhash: true, width: true, height: true } } },
      orderBy: { sortOrder: 'asc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((p) => ({
        url: this.url(p.media.storageKey),
        blurhash: p.media.blurhash,
        width: p.media.width,
        height: p.media.height,
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 22 "Mesaj göndər" — söhbət Sprint 7-də açılır, hazırda sorğu qeydə alınır. */
  async contact(userId: bigint, slug: string, message: string) {
    const b = await this.prisma.business.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, name: true, ownerId: true, phone: true },
    });
    if (!b) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Biznes tapılmadı: ${slug}` });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'business.contact',
        targetType: 'business',
        targetId: b.id,
        after: { message: message.slice(0, 1000) },
      },
    });

    return {
      sent: true,
      business: { slug, name: b.name, phone: b.phone },
      note: 'Söhbət funksiyası Sprint 7-də açılacaq — hazırda sorğunuz qeydə alındı',
    };
  }
}
