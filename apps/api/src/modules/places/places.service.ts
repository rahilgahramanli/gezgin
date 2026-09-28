import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ReportsService } from '@/modules/community/reports.service';
import { clusterPrecision, distanceMeters, formatDistanceKm, withinBox, withinRadius } from '@/common/search/geo';
import { toBooleanQuery } from '@/common/search/normalize';
import { translationJoin } from '@/common/search/translation';
import { CATEGORY_NAME_SELECT, categoryName, text } from '@/common/i18n';
import type { AddPlacePhotoDto, ListPlacesDto, MapPlacesDto, NearbyDto, ReportPlaceDto } from './dto/places.dto';

type Lang = 'az' | 'en' | 'ru';

/** Qiymət səviyyəsi → giriş haqqı aralığı (AZN). Ekran 45 `₼ / ₼₼ / ₼₼₼`. */
const PRICE_BANDS: Record<number, { min: number; max: number | null }> = {
  0: { min: 0, max: 0 },
  1: { min: 0.01, max: 5 },
  2: { min: 5.01, max: 20 },
  3: { min: 20.01, max: null },
};

interface PlaceRow {
  slug: string;
  lat: Prisma.Decimal;
  lng: Prisma.Decimal;
  rating_avg: Prisma.Decimal;
  rating_count: number;
  entrance_fee_azn: Prisma.Decimal | null;
  altitude_m: number | null;
  is_featured: number;
  checkin_count: number;
  name: string;
  description: string | null;
  region_slug: string;
  region_name: string;
  cover_key: string | null;
  cover_blurhash: string | null;
  distance_m: number | null;
}

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly reports: ReportsService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private shape(r: PlaceRow) {
    return {
      slug: r.slug,
      name: r.name,
      description: r.description,
      lat: Number(r.lat),
      lng: Number(r.lng),
      rating: Number(r.rating_avg),
      ratingCount: r.rating_count,
      entranceFeeAzn: r.entrance_fee_azn === null ? null : Number(r.entrance_fee_azn),
      altitudeM: r.altitude_m,
      isFeatured: Boolean(r.is_featured),
      checkinCount: r.checkin_count,
      region: { slug: r.region_slug, name: r.region_name },
      coverUrl: this.url(r.cover_key),
      blurhash: r.cover_blurhash,
      distanceKm: formatDistanceKm(r.distance_m === null ? null : Number(r.distance_m)),
    };
  }

  /**
   * Ekran 12 siyahısı. Coğrafi və FULLTEXT filtrləri Prisma-nın query builder-i
   * ilə ifadə oluna bilmədiyi üçün raw SQL ilə qurulur.
   */
  async list(dto: ListPlacesDto, lang: Lang) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.status = 'published'`,
    ];

    if (dto.region) conditions.push(Prisma.sql`r.slug = ${dto.region}`);
    if (dto.featured) conditions.push(Prisma.sql`p.is_featured = 1`);
    if (dto.minRating !== undefined) conditions.push(Prisma.sql`p.rating_avg >= ${dto.minRating}`);

    if (dto.priceLevel !== undefined) {
      const band = PRICE_BANDS[dto.priceLevel];
      conditions.push(
        band.max === null
          ? Prisma.sql`p.entrance_fee_azn >= ${band.min}`
          : Prisma.sql`COALESCE(p.entrance_fee_azn, 0) BETWEEN ${band.min} AND ${band.max}`,
      );
    }

    if (dto.categories?.length) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM place_categories pc
        JOIN categories c ON c.id = pc.category_id
        WHERE pc.place_id = p.id AND c.slug IN (${Prisma.join(dto.categories)})
      )`);
    }

    const hasGeo = dto.lat !== undefined && dto.lng !== undefined;
    if (hasGeo && dto.radiusKm) {
      conditions.push(withinRadius('p.geo', dto.lng!, dto.lat!, dto.radiusKm * 1000));
    }

    const booleanQuery = dto.q ? toBooleanQuery(dto.q) : null;
    if (booleanQuery) {
      conditions.push(Prisma.sql`MATCH(t.search_text) AGAINST(${booleanQuery} IN BOOLEAN MODE)`);
    } else if (dto.q) {
      // Sorğu FULLTEXT üçün çox qısadır (min token 3) — prefiks LIKE-a düşürük
      conditions.push(Prisma.sql`t.search_text LIKE ${`%${dto.q.toLowerCase()}%`}`);
    }

    const distanceSelect = hasGeo
      ? Prisma.sql`${distanceMeters('p.geo', dto.lng!, dto.lat!)} AS distance_m`
      : Prisma.sql`NULL AS distance_m`;

    const relevance = booleanQuery
      ? Prisma.sql`MATCH(t.search_text) AGAINST(${booleanQuery} IN BOOLEAN MODE) DESC,`
      : Prisma.empty;

    const orderBy = {
      distance: hasGeo ? Prisma.sql`distance_m ASC` : Prisma.sql`p.rating_avg DESC`,
      rating: Prisma.sql`p.rating_avg DESC, p.rating_count DESC`,
      newest: Prisma.sql`p.created_at DESC`,
      popular: Prisma.sql`p.is_featured DESC, p.checkin_count DESC, p.rating_avg DESC`,
    }[dto.sort ?? 'popular'];

    const where = Prisma.join(conditions, ' AND ');
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;

    const rows = await this.prisma.$queryRaw<PlaceRow[]>`
      SELECT p.slug, p.lat, p.lng, p.rating_avg, p.rating_count, p.entrance_fee_azn,
             p.altitude_m, p.is_featured, p.checkin_count,
             t.name, t.description,
             r.slug AS region_slug, rt.name AS region_name,
             (SELECT m.storage_key FROM place_photos ph JOIN media_assets m ON m.id = ph.media_id
              WHERE ph.place_id = p.id AND m.deleted_at IS NULL
              ORDER BY ph.is_cover DESC, ph.sort_order ASC LIMIT 1) AS cover_key,
             (SELECT m.blurhash FROM place_photos ph JOIN media_assets m ON m.id = ph.media_id
              WHERE ph.place_id = p.id AND m.deleted_at IS NULL
              ORDER BY ph.is_cover DESC, ph.sort_order ASC LIMIT 1) AS cover_blurhash,
             ${distanceSelect}
      FROM places p
      JOIN regions r ON r.id = p.region_id
      ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang, left: true })}
      ${translationJoin({ table: 'place_translations', fk: 'place_id', alias: 't', owner: 'p', lang })}
      WHERE ${where}
      ORDER BY ${relevance} ${orderBy}
      LIMIT ${limit + 1} OFFSET ${offset}
    `;

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((r) => this.shape(r)),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /**
   * Ekran 12 xəritəsi. Çox pini brauzerə göndərmək əvəzinə server tərəfdə
   * şəbəkə üzrə klasterlənir — zoom artdıqca xanalar kiçilir.
   */
  async map(dto: MapPlacesDto, lang: Lang) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.status = 'published'`,
    ];

    if (dto.region) conditions.push(Prisma.sql`r.slug = ${dto.region}`);
    if (dto.categories?.length) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
        WHERE pc.place_id = p.id AND c.slug IN (${Prisma.join(dto.categories)})
      )`);
    }

    if (dto.bbox) {
      const parts = dto.bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'bbox formatı: minLng,minLat,maxLng,maxLat',
        });
      }
      const [minLng, minLat, maxLng, maxLat] = parts;
      conditions.push(withinBox('p.geo', { minLng, minLat, maxLng, maxLat }));
    }

    const where = Prisma.join(conditions, ' AND ');
    const zoom = dto.zoom ?? 10;
    const precision = clusterPrecision(zoom);

    // Yüksək zoom-da fərdi pinlər, aşağı zoom-da klasterlər
    if (zoom >= 13) {
      const rows = await this.prisma.$queryRaw<Array<{ slug: string; name: string; lat: Prisma.Decimal; lng: Prisma.Decimal; rating_avg: Prisma.Decimal; category_slug: string | null }>>`
        SELECT p.slug, t.name, p.lat, p.lng, p.rating_avg,
               (SELECT c.slug FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                WHERE pc.place_id = p.id ORDER BY pc.is_primary DESC LIMIT 1) AS category_slug
        FROM places p
        JOIN regions r ON r.id = p.region_id
        ${translationJoin({ table: 'place_translations', fk: 'place_id', alias: 't', owner: 'p', lang })}
        WHERE ${where}
        LIMIT 300
      `;
      return {
        mode: 'points' as const,
        zoom,
        items: rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          lat: Number(r.lat),
          lng: Number(r.lng),
          rating: Number(r.rating_avg),
          category: r.category_slug,
        })),
      };
    }

    const clusters = await this.prisma.$queryRaw<Array<{ count: bigint; lat: number; lng: number; sample: string; sample_slug: string; sample_rating: Prisma.Decimal | null }>>`
      SELECT COUNT(*) AS count,
             AVG(p.lat) AS lat,
             AVG(p.lng) AS lng,
             MIN(t.name) AS sample,
             MIN(p.slug) AS sample_slug,
             MIN(p.rating_avg) AS sample_rating
      FROM places p
      JOIN regions r ON r.id = p.region_id
      ${translationJoin({ table: 'place_translations', fk: 'place_id', alias: 't', owner: 'p', lang })}
      WHERE ${where}
      GROUP BY FLOOR(p.lat / ${precision}), FLOOR(p.lng / ${precision})
      LIMIT 200
    `;

    return {
      mode: 'clusters' as const,
      zoom,
      precision,
      items: clusters.map((c) => ({
        count: Number(c.count),
        lat: Number(c.lat),
        lng: Number(c.lng),
        sampleName: c.sample,
        // Tək məkanlı klaster xəritədə pin kimi göstərilir — kartı açmaq üçün slug lazımdır
        ...(Number(c.count) === 1 ? { slug: c.sample_slug, rating: Number(c.sample_rating ?? 0) } : {}),
      })),
    };
  }

  /** Ekran 13 — məkan detalı. */
  /** Baxan istifadəçi bu obyekti saxlayıbmı — detal ekranındakı düymə üçün. */
  private async isSaved(viewerId: bigint | undefined, type: 'place', targetId: bigint): Promise<boolean> {
    if (viewerId === undefined) return false;
    const count = await this.prisma.savedItem.count({
      where: { userId: viewerId, targetType: type, targetId },
    });
    return count > 0;
  }

  async detail(slug: string, lang: Lang, viewerId?: bigint) {
    const place = await this.prisma.place.findFirst({
      where: { slug, deletedAt: null },
      include: {
        translations: { select: { lang: true, name: true, description: true } },
        region: { include: { translations: { select: { lang: true, name: true } } } },
        categories: { include: { category: { select: { slug: true, ...CATEGORY_NAME_SELECT, icon: true } } } },
        photos: {
          where: { media: { deletedAt: null } },
          include: { media: { select: { storageKey: true, blurhash: true, width: true, height: true } } },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
          take: 10,
        },
        _count: { select: { photos: true, checkins: true } },
      },
    });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${slug}` });

    const t = place.translations.find((x) => x.lang === lang) ?? place.translations.find((x) => x.lang === 'az');
    const rt = place.region.translations.find((x) => x.lang === lang) ?? place.region.translations.find((x) => x.lang === 'az');

    const reviewCount = await this.prisma.review.count({
      where: { targetType: 'place', targetId: place.id, deletedAt: null, isVisible: true },
    });
    // Qalereya ilə eyni say: məkan fotoları + məkana etiketlənmiş ictimai paylaşımların fotoları
    const postPhotoCount = await this.prisma.postMedia.count({
      where: {
        media: { deletedAt: null, status: 'ready' },
        post: { placeId: place.id, deletedAt: null, visibility: 'public', user: { status: 'active', isPublic: true } },
      },
    });

    return {
      slug: place.slug,
      name: t?.name ?? place.slug,
      description: t?.description ?? null,
      lat: Number(place.lat),
      lng: Number(place.lng),
      altitudeM: place.altitudeM,
      address: place.address,
      phone: place.phone,
      website: place.website,
      bestSeason: place.bestSeason,
      visitDurationH: place.visitDurationH === null ? null : Number(place.visitDurationH),
      entranceFeeAzn: place.entranceFeeAzn === null ? null : Number(place.entranceFeeAzn),
      rating: Number(place.ratingAvg),
      ratingCount: place.ratingCount,
      reviewCount,
      // Ekran 13 "saxla" düyməsi vəziyyəti göstərməlidir, əks halda yalnız saxlaya bilir
      isSaved: await this.isSaved(viewerId, 'place', place.id),
      checkinCount: place._count.checkins,
      photoCount: place._count.photos + postPhotoCount,
      isFeatured: place.isFeatured,
      region: { slug: place.region.slug, name: rt?.name ?? place.region.slug },
      categories: place.categories.map((c) => ({
        slug: c.category.slug,
        name: categoryName(c.category),
        icon: c.category.icon,
        isPrimary: c.isPrimary,
      })),
      photos: place.photos.map((p) => ({
        url: this.url(p.media.storageKey),
        blurhash: p.media.blurhash,
        width: p.media.width,
        height: p.media.height,
        isOfficial: p.isOfficial,
      })),
    };
  }

  /** Ekran 46 — foto qalereyası. */
  /**
   * Məkanın foto qalereyası. "Gezginlərdən" iki mənbədən yığılır: məkana birbaşa
   * yüklənmiş fotolar və həmin məkana etiketlənmiş ictimai paylaşımların fotoları —
   * qalereyadakı "Foto əlavə et" paylaşım yaradır, o fotolar da burada görünməlidir.
   * Qapalı hesabların, "İzləyicilər"/"Yalnız mən" paylaşımlarının fotoları daxil edilmir.
   */
  async photos(slug: string, filter: 'all' | 'official' | 'community', offset = 0, limit = 30) {
    const place = await this.prisma.place.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${slug}` });

    const ready = { deletedAt: null, status: 'ready' as const };
    const placeWhere = {
      placeId: place.id,
      media: ready,
      ...(filter === 'official' ? { isOfficial: true } : filter === 'community' ? { isOfficial: false } : {}),
    };
    const postWhere = {
      media: ready,
      post: {
        placeId: place.id,
        deletedAt: null,
        visibility: 'public' as const,
        user: { status: 'active' as const, isPublic: true },
      },
    };
    const userSelect = { username: true, fullName: true, avatar: { select: { storageKey: true } } };
    const mediaSelect = { publicId: true, storageKey: true, blurhash: true, width: true, height: true };
    // Qalereyalar kiçikdir — iki mənbəni yaddaşda birləşdirib səhifələyirik
    const window = offset + limit + 1;

    const [placeRows, postRows, counts, postCount] = await Promise.all([
      this.prisma.placePhoto.findMany({
        where: placeWhere,
        include: { media: { select: mediaSelect }, uploadedBy: { select: userSelect } },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { id: 'desc' }],
        take: window,
      }),
      filter === 'official'
        ? Promise.resolve([])
        : this.prisma.postMedia.findMany({
            where: postWhere,
            include: { media: { select: mediaSelect }, post: { select: { user: { select: userSelect } } } },
            orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
            take: window,
          }),
      this.prisma.placePhoto.groupBy({
        by: ['isOfficial'],
        where: { placeId: place.id, media: ready },
        _count: true,
      }),
      this.prisma.postMedia.count({ where: postWhere }),
    ]);

    const official = counts.find((c) => c.isOfficial)?._count ?? 0;
    const community = (counts.find((c) => !c.isOfficial)?._count ?? 0) + postCount;

    type Author = { username: string; fullName: string; avatar: { storageKey: string } | null } | null;
    const shape = (
      m: { publicId: string; storageKey: string; blurhash: string | null; width: number | null; height: number | null },
      isOfficial: boolean,
      by: Author,
    ) => ({
      mediaPublicId: m.publicId,
      url: this.url(m.storageKey),
      blurhash: m.blurhash,
      width: m.width,
      height: m.height,
      isOfficial,
      uploadedBy: by ? { username: by.username, fullName: by.fullName, avatarUrl: this.url(by.avatar?.storageKey) } : null,
    });

    // Rəsmi fotolar əvvəl, sonra gezginlərin fotoları; eyni media iki dəfə göstərilmir
    const seen = new Set<string>();
    const merged = [
      ...placeRows.map((p) => shape(p.media, p.isOfficial, p.uploadedBy)),
      ...postRows.map((pm) => shape(pm.media, false, pm.post.user)),
    ].filter((x) => (seen.has(x.mediaPublicId) ? false : (seen.add(x.mediaPublicId), true)));

    const page = merged.slice(offset, offset + limit);
    return {
      counts: { all: official + community, official, community },
      data: page,
      nextOffset: merged.length > offset + limit ? offset + limit : null,
    };
  }

  /** Ekran 13 "Yaxınlıqdakılar" tabı. */
  async nearby(slug: string, dto: NearbyDto, lang: Lang) {
    const place = await this.prisma.place.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, lat: true, lng: true },
    });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${slug}` });

    const lat = Number(place.lat);
    const lng = Number(place.lng);
    const radiusM = (dto.radiusKm ?? 20) * 1000;

    const rows = await this.prisma.$queryRaw<PlaceRow[]>`
      SELECT p.slug, p.lat, p.lng, p.rating_avg, p.rating_count, p.entrance_fee_azn,
             p.altitude_m, p.is_featured, p.checkin_count,
             t.name, t.description,
             r.slug AS region_slug, rt.name AS region_name,
             (SELECT m.storage_key FROM place_photos ph JOIN media_assets m ON m.id = ph.media_id
              WHERE ph.place_id = p.id AND m.deleted_at IS NULL
              ORDER BY ph.is_cover DESC, ph.sort_order ASC LIMIT 1) AS cover_key,
             (SELECT m.blurhash FROM place_photos ph JOIN media_assets m ON m.id = ph.media_id
              WHERE ph.place_id = p.id AND m.deleted_at IS NULL
              ORDER BY ph.is_cover DESC, ph.sort_order ASC LIMIT 1) AS cover_blurhash,
             ${distanceMeters('p.geo', lng, lat)} AS distance_m
      FROM places p
      JOIN regions r ON r.id = p.region_id
      ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang, left: true })}
      ${translationJoin({ table: 'place_translations', fk: 'place_id', alias: 't', owner: 'p', lang })}
      WHERE p.id <> ${place.id} AND p.deleted_at IS NULL AND p.status = 'published'
        AND ${withinRadius('p.geo', lng, lat, radiusM)}
      ORDER BY distance_m ASC
      LIMIT ${dto.limit ?? 10}
    `;
    return rows.map((r) => this.shape(r));
  }

  /** Ekran 45 — mövcud filtr seçimləri. */
  async filters(region?: string) {
    const regionRow = region
      ? await this.prisma.region.findUnique({ where: { slug: region }, select: { id: true } })
      : null;

    const [categories, agg] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true, types: { contains: 'place' } },
        select: { slug: true, ...CATEGORY_NAME_SELECT, icon: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.place.aggregate({
        where: { deletedAt: null, status: 'published', ...(regionRow ? { regionId: regionRow.id } : {}) },
        _count: true,
        _max: { entranceFeeAzn: true },
      }),
    ]);

    return {
      categories: categories.map((c) => ({ slug: c.slug, name: categoryName(c), icon: c.icon })),
      ratings: [0, 4.0, 4.5, 4.8],
      priceLevels: [
        { level: 0, label: text('free') },
        { level: 1, label: '₼' },
        { level: 2, label: '₼₼' },
        { level: 3, label: '₼₼₼' },
      ],
      distanceKm: { min: 1, max: 100, default: 25 },
      totalPlaces: agg._count,
      maxEntranceFeeAzn: agg._max.entranceFeeAzn === null ? null : Number(agg._max.entranceFeeAzn),
    };
  }

  /** Ekran 46 — istifadəçi foto əlavə edir (+300 XP Sprint 5-də bağlanacaq). */
  async addPhoto(userId: bigint, slug: string, dto: AddPlacePhotoDto) {
    const [place, media] = await Promise.all([
      this.prisma.place.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }),
      this.prisma.mediaAsset.findUnique({ where: { publicId: dto.mediaPublicId } }),
    ]);
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${slug}` });
    if (!media || media.status !== 'ready') {
      throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Media tapılmadı və ya yüklənməyib' });
    }
    if (media.ownerId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu media sizə aid deyil' });
    }

    const existing = await this.prisma.placePhoto.findFirst({ where: { placeId: place.id, mediaId: media.id } });
    if (existing) return { added: true, duplicate: true };

    const max = await this.prisma.placePhoto.aggregate({ where: { placeId: place.id }, _max: { sortOrder: true } });
    await this.prisma.placePhoto.create({
      data: {
        placeId: place.id,
        mediaId: media.id,
        uploadedById: userId,
        isOfficial: false,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    return { added: true, duplicate: false };
  }

  async report(userId: bigint, slug: string, dto: ReportPlaceDto) {
    const place = await this.prisma.place.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${slug}` });

    // Paylaşımlardakı kimi: açıq şikayət varkən təkrar yazılmır, `duplicate: true` qayıdır
    return this.reports.report(userId, { type: 'place', id: place.id, ownerId: null }, dto);
  }
}
