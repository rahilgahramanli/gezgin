import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { toBooleanQuery } from '@/common/search/normalize';
import { translationJoin } from '@/common/search/translation';
import { XpService } from '@/modules/gamification/xp.service';
import type {
  AddStopDto, CreateRouteDto, ListRoutesDto, ReorderStopsDto, UpdateRouteDto, UpdateStopDto,
} from './dto/routes.dto';

type Lang = 'az' | 'en' | 'ru';

/** Ekran 14-dəki müddət çipləri: "1", "2-3", "7+". */
function parseDuration(value: string): { min: number; max: number | null } {
  if (value.endsWith('+')) return { min: Number(value.slice(0, -1)), max: null };
  const [min, max] = value.split('-').map(Number);
  return { min, max: max ?? min };
}

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly xp: XpService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private async loadOwned(slug: string, userId: bigint) {
    const route = await this.prisma.route.findFirst({ where: { slug, deletedAt: null } });
    if (!route) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${slug}` });
    if (route.authorId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu marşrut sizə aid deyil' });
    }
    return route;
  }

  /** Dayanacaq yalnız marşrutun mövcud günlərinə qoyula bilər — yarat, yenilə və sırala eyni qayda. */
  private assertDay(route: { days: number }, day: number): void {
    if (day > route.days) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Marşrut ${route.days} günlükdür — ${day}-ci gün yoxdur`,
      });
    }
  }

  private async uniqueSlug(base: string): Promise<string> {
    const clean =
      base.toLowerCase()
        .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
        .replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'marsrut';

    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? clean : `${clean}-${i}`;
      const taken = await this.prisma.route.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${clean}-${Date.now().toString(36)}`;
  }

  /** Günün dayanacaqlarını 0-dan ardıcıl nömrələyir — bax: TripsService.renumberDay */
  private async renumberDay(routeId: bigint, dayNumber: number): Promise<void> {
    const stops = await this.prisma.routeStop.findMany({
      where: { routeId, dayNumber },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const PARK = 10_000;
    await this.prisma.$transaction([
      ...stops.map((s, i) => this.prisma.routeStop.update({ where: { id: s.id }, data: { sortOrder: PARK + i } })),
      ...stops.map((s, i) => this.prisma.routeStop.update({ where: { id: s.id }, data: { sortOrder: i } })),
    ]);
  }

  /** Marşrutun ümumi məsafəsi — ardıcıl dayanacaqlar arasındakı böyük dairə məsafələri. */
  private async recomputeDistance(routeId: bigint): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ total: number | null }>>`
      SELECT SUM(ST_Distance_Sphere(a.geo, b.geo)) AS total
      FROM (
        SELECT rs.place_id, ROW_NUMBER() OVER (ORDER BY rs.day_number, rs.sort_order) AS rn
        FROM route_stops rs WHERE rs.route_id = ${routeId}
      ) s1
      JOIN (
        SELECT rs.place_id, ROW_NUMBER() OVER (ORDER BY rs.day_number, rs.sort_order) AS rn
        FROM route_stops rs WHERE rs.route_id = ${routeId}
      ) s2 ON s2.rn = s1.rn + 1
      JOIN places a ON a.id = s1.place_id
      JOIN places b ON b.id = s2.place_id
    `;
    const meters = rows[0]?.total ?? 0;
    await this.prisma.route.update({
      where: { id: routeId },
      data: { distanceKm: new Prisma.Decimal(Math.round((Number(meters) / 1000) * 10) / 10) },
    });
  }

  // ─────────────────── oxu ───────────────────

  async list(dto: ListRoutesDto, lang: Lang, viewerId?: bigint) {
    const where: Prisma.RouteWhereInput = {
      deletedAt: null,
      status: 'published',
      visibility: { in: ['public', 'official'] },
      ...(dto.region ? { region: { slug: dto.region } } : {}),
      ...(dto.difficulty ? { difficulty: dto.difficulty } : {}),
    };

    if (dto.duration) {
      const { min, max } = parseDuration(dto.duration);
      where.days = max === null ? { gte: min } : { gte: min, lte: max };
    }
    if (dto.categories?.length) {
      where.OR = dto.categories.map((c) => ({ categories: { contains: c } }));
    }
    if (dto.q) {
      const bq = toBooleanQuery(dto.q);
      if (bq) {
        // Tərcüməsi olmayan marşrut (istifadəçi marşrutları yalnız AZ-dır) AZ mətnində axtarılır
        const ids = await this.prisma.$queryRaw<Array<{ route_id: bigint }>>`
          SELECT ro.id AS route_id FROM routes ro
          ${translationJoin({ table: 'route_translations', fk: 'route_id', alias: 't', owner: 'ro', lang })}
          WHERE MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE)
          LIMIT 200
        `;
        where.id = { in: ids.map((i) => i.route_id) };
      } else {
        where.id = { in: [] };
      }
    }

    const orderBy: Prisma.RouteOrderByWithRelationInput[] = {
      popular: [{ copyCount: 'desc' as const }, { ratingAvg: 'desc' as const }],
      rating: [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }],
      newest: [{ createdAt: 'desc' as const }],
      shortest: [{ days: 'asc' as const }],
    }[dto.sort ?? 'popular'];

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.route.findMany({
      where,
      orderBy: [...orderBy, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: {
        translations: { select: { lang: true, title: true, description: true } },
        region: { include: { translations: { select: { lang: true, name: true } } } },
        cover: { select: { storageKey: true, blurhash: true } },
        author: { select: { username: true, fullName: true, role: true } },
        _count: { select: { stops: true } },
        ...(viewerId ? { trips: { where: { userId: viewerId }, select: { publicId: true }, take: 1 } } : {}),
      },
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((r) => this.shapeCard(r, lang)),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Siyahı kartı üçün lazım olan minimal forma — sorğudakı `select` ilə uyğundur. */
  private shapeCard(
    r: {
      slug: string;
      days: number;
      nights: number;
      distanceKm: Prisma.Decimal | null;
      difficulty: string;
      categories: string | null;
      visibility: string;
      ratingAvg: Prisma.Decimal;
      ratingCount: number;
      copyCount: number;
      translations: Array<{ lang: string; title: string; description: string | null }>;
      region: { slug: string; translations: Array<{ lang: string; name: string }> };
      cover: { storageKey: string; blurhash: string | null } | null;
      author: { username: string; fullName: string; role: string } | null;
      _count: { stops: number };
    },
    lang: Lang,
  ) {
    const t = r.translations.find((x) => x.lang === lang) ?? r.translations.find((x) => x.lang === 'az');
    const rt = r.region.translations.find((x) => x.lang === lang) ?? r.region.translations.find((x) => x.lang === 'az');
    return {
      slug: r.slug,
      title: t?.title ?? r.slug,
      description: t?.description ?? null,
      days: r.days,
      nights: r.nights,
      distanceKm: r.distanceKm === null ? null : Number(r.distanceKm),
      difficulty: r.difficulty,
      categories: r.categories ? r.categories.split('|') : [],
      stopCount: r._count.stops,
      rating: Number(r.ratingAvg),
      ratingCount: r.ratingCount,
      copyCount: r.copyCount,
      isOfficial: r.visibility === 'official',
      coverUrl: this.url(r.cover?.storageKey),
      blurhash: r.cover?.blurhash ?? null,
      region: { slug: r.region.slug, name: rt?.name ?? r.region.slug },
      author: r.author
        ? { username: r.author.username, fullName: r.author.fullName, isLocalExpert: r.author.role === 'local_expert' }
        : null,
    };
  }

  /** Ekran 15 — gün-gün dayanacaqlarla tam detal. */
  /** Baxan istifadəçi marşrutu saxlayıbmı. */
  private async isSavedByViewer(viewerId: bigint | undefined, routeId: bigint): Promise<boolean> {
    if (viewerId === undefined) return false;
    const count = await this.prisma.savedItem.count({
      where: { userId: viewerId, targetType: 'route', targetId: routeId },
    });
    return count > 0;
  }

  async detail(slug: string, lang: Lang, viewerId?: bigint) {
    const route = await this.prisma.route.findFirst({
      where: { slug, deletedAt: null },
      include: {
        translations: { select: { lang: true, title: true, description: true } },
        region: { include: { translations: { select: { lang: true, name: true } } } },
        cover: { select: { storageKey: true, blurhash: true } },
        author: { select: { id: true, username: true, fullName: true, role: true, avatar: { select: { storageKey: true } } } },
        routeDays: { orderBy: { dayNumber: 'asc' } },
        stops: {
          orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
          include: {
            place: {
              include: {
                translations: { select: { lang: true, name: true } },
                photos: {
                  where: { media: { deletedAt: null } },
                  include: { media: { select: { storageKey: true, blurhash: true } } },
                  orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
                  take: 1,
                },
              },
            },
          },
        },
        _count: { select: { stops: true } },
      },
    });
    if (!route) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${slug}` });

    const isOwner = viewerId !== undefined && route.authorId === viewerId;
    if (route.visibility === 'private' && !isOwner) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${slug}` });
    }

    const t = route.translations.find((x) => x.lang === lang) ?? route.translations.find((x) => x.lang === 'az');
    const rt = route.region.translations.find((x) => x.lang === lang) ?? route.region.translations.find((x) => x.lang === 'az');

    const byDay = new Map<number, typeof route.stops>();
    for (const s of route.stops) {
      const list = byDay.get(s.dayNumber) ?? [];
      list.push(s);
      byDay.set(s.dayNumber, list);
    }

    return {
      slug: route.slug,
      title: t?.title ?? route.slug,
      description: t?.description ?? null,
      days: route.days,
      nights: route.nights,
      distanceKm: route.distanceKm === null ? null : Number(route.distanceKm),
      difficulty: route.difficulty,
      categories: route.categories ? route.categories.split('|') : [],
      visibility: route.visibility,
      isOfficial: route.visibility === 'official',
      isOwner,
      // Ekran 15 "saxla" düyməsi vəziyyəti göstərsin
      isSaved: await this.isSavedByViewer(viewerId, route.id),
      rating: Number(route.ratingAvg),
      ratingCount: route.ratingCount,
      copyCount: route.copyCount,
      stopCount: route._count.stops,
      coverUrl: this.url(route.cover?.storageKey),
      region: { slug: route.region.slug, name: rt?.name ?? route.region.slug },
      author: route.author
        ? {
            username: route.author.username,
            fullName: route.author.fullName,
            isLocalExpert: route.author.role === 'local_expert',
            avatarUrl: this.url(route.author.avatar?.storageKey),
          }
        : null,
      itinerary: Array.from({ length: route.days }, (_, i) => i + 1).map((day) => ({
        day,
        title: route.routeDays.find((d) => d.dayNumber === day)?.titleAz ?? null,
        stops: (byDay.get(day) ?? []).map((s) => {
          const pt = s.place.translations.find((x) => x.lang === lang) ?? s.place.translations.find((x) => x.lang === 'az');
          return {
            stopId: Number(s.id),
            order: s.sortOrder,
            arriveTime: s.arriveTime,
            durationMin: s.durationMin,
            note: s.noteAz,
            place: {
              slug: s.place.slug,
              name: pt?.name ?? s.place.slug,
              lat: Number(s.place.lat),
              lng: Number(s.place.lng),
              rating: Number(s.place.ratingAvg),
              coverUrl: this.url(s.place.photos[0]?.media.storageKey),
            },
          };
        }),
      })),
    };
  }

  /** Ekran 14 "Tövsiyə olunan marşrutlar". */
  async recommended(lang: Lang, region?: string, limit = 10) {
    return this.list({ region, sort: 'rating', limit }, lang);
  }

  /** Ekran 14 "Sənin marşrutların" — şəxsi olanlar da daxil. */
  async mine(userId: bigint, lang: Lang, offset = 0, limit = 20) {
    const rows = await this.prisma.route.findMany({
      where: { authorId: userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit + 1,
      include: {
        translations: { select: { lang: true, title: true, description: true } },
        region: { include: { translations: { select: { lang: true, name: true } } } },
        cover: { select: { storageKey: true, blurhash: true } },
        author: { select: { username: true, fullName: true, role: true } },
        _count: { select: { stops: true } },
      },
    });
    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((r) => ({ ...this.shapeCard(r, lang), visibility: r.visibility })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  // ─────────────────── yazma ───────────────────

  async create(userId: bigint, dto: CreateRouteDto, lang: Lang) {
    const region = await this.prisma.region.findUnique({ where: { slug: dto.region }, select: { id: true } });
    if (!region) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Region tapılmadı: ${dto.region}` });

    let coverId: bigint | null = null;
    if (dto.coverMediaPublicId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: dto.coverMediaPublicId } });
      if (!media || media.ownerId !== userId) {
        throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Cover media tapılmadı' });
      }
      coverId = media.id;
    }

    const days = dto.days ?? 1;
    const slug = await this.uniqueSlug(dto.title);

    const route = await this.prisma.route.create({
      data: {
        publicId: ulid(),
        slug,
        authorId: userId,
        regionId: region.id,
        days,
        nights: Math.max(0, days - 1),
        difficulty: dto.difficulty ?? 'asan',
        categories: dto.categories?.length ? dto.categories.join('|') : null,
        visibility: dto.isPublic ? 'public' : 'private',
        coverId,
        translations: { create: { lang: 'az', title: dto.title, description: dto.description ?? null } },
        routeDays: { create: Array.from({ length: days }, (_, i) => ({ dayNumber: i + 1 })) },
      },
    });

    // Ekran 14/50: "Öz marşrutunu yarat · +350 XP"
    const reward = await this.xp.award(userId, 'route_created', { type: 'route', id: route.id, note: dto.title });

    return { ...(await this.detail(route.slug, lang, userId)), rewards: reward };
  }

  async update(userId: bigint, slug: string, dto: UpdateRouteDto, lang: Lang) {
    const route = await this.loadOwned(slug, userId);

    let coverId: bigint | undefined;
    if (dto.coverMediaPublicId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: dto.coverMediaPublicId } });
      if (!media || media.ownerId !== userId) {
        throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Cover media tapılmadı' });
      }
      coverId = media.id;
    }

    // Gün sayı azalırsa, kəsilən günlərdə dayanacaq qalmamalıdır — əks halda itib görünməz olurlar
    if (dto.days !== undefined && dto.days < route.days) {
      const beyond = await this.prisma.routeStop.aggregate({
        where: { routeId: route.id, dayNumber: { gt: dto.days } },
        _max: { dayNumber: true },
      });
      const lastDay = beyond._max.dayNumber;
      if (lastDay !== null) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: `Marşrutun ${lastDay}. günündə dayanacaq var — gün sayını ${dto.days} etməzdən əvvəl onları başqa günə köçürün və ya silin`,
        });
      }
    }

    await this.prisma.route.update({
      where: { id: route.id },
      data: {
        ...(dto.days !== undefined ? { days: dto.days, nights: Math.max(0, dto.days - 1) } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.categories !== undefined ? { categories: dto.categories.join('|') || null } : {}),
        ...(dto.isPublic !== undefined ? { visibility: dto.isPublic ? 'public' : 'private' } : {}),
        ...(coverId !== undefined ? { coverId } : {}),
      },
    });

    if (dto.title !== undefined || dto.description !== undefined) {
      await this.prisma.routeTranslation.upsert({
        where: { routeId_lang: { routeId: route.id, lang: 'az' } },
        update: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        create: { routeId: route.id, lang: 'az', title: dto.title ?? slug, description: dto.description ?? null },
      });
    }

    // Gün sayı artdısa yeni günlər yaradılır
    if (dto.days !== undefined) {
      const existing = await this.prisma.routeDay.findMany({ where: { routeId: route.id }, select: { dayNumber: true } });
      const have = new Set(existing.map((d) => d.dayNumber));
      const missing = Array.from({ length: dto.days }, (_, i) => i + 1).filter((d) => !have.has(d));
      if (missing.length) {
        await this.prisma.routeDay.createMany({ data: missing.map((dayNumber) => ({ routeId: route.id, dayNumber })) });
      }
      // Azalıbsa artıq günlər silinir (yuxarıdakı yoxlamaya görə onlarda dayanacaq yoxdur)
      await this.prisma.routeDay.deleteMany({
        where: { routeId: route.id, dayNumber: { gt: dto.days }, stops: { none: {} } },
      });
    }

    return this.detail(slug, lang, userId);
  }

  async remove(userId: bigint, slug: string) {
    const route = await this.loadOwned(slug, userId);
    await this.prisma.route.update({ where: { id: route.id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  // ─────────────────── dayanacaqlar (ekran 50) ───────────────────

  async addStop(userId: bigint, slug: string, dto: AddStopDto, lang: Lang) {
    const route = await this.loadOwned(slug, userId);
    const place = await this.prisma.place.findFirst({ where: { slug: dto.place, deletedAt: null }, select: { id: true } });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.place}` });

    const day = dto.day ?? 1;
    this.assertDay(route, day);

    const order =
      dto.order ??
      ((await this.prisma.routeStop.aggregate({
        where: { routeId: route.id, dayNumber: day },
        _max: { sortOrder: true },
      }))._max.sortOrder ?? -1) + 1;

    const routeDay = await this.prisma.routeDay.findUnique({
      where: { routeId_dayNumber: { routeId: route.id, dayNumber: day } },
    });

    // Eyni gün-sıra tutulubsa sonrakıları bir addım aşağı sürüşdürürük
    await this.prisma.routeStop.updateMany({
      where: { routeId: route.id, dayNumber: day, sortOrder: { gte: order } },
      data: { sortOrder: { increment: 1 } },
    });

    await this.prisma.routeStop.create({
      data: {
        routeId: route.id,
        routeDayId: routeDay?.id ?? null,
        placeId: place.id,
        dayNumber: day,
        sortOrder: order,
        arriveTime: dto.arriveTime ?? null,
        durationMin: dto.durationMin ?? null,
        noteAz: dto.note ?? null,
      },
    });

    await this.renumberDay(route.id, day);
    await this.recomputeDistance(route.id);
    return this.detail(slug, lang, userId);
  }

  async updateStop(userId: bigint, slug: string, stopId: number, dto: UpdateStopDto, lang: Lang) {
    const route = await this.loadOwned(slug, userId);
    const stop = await this.prisma.routeStop.findFirst({ where: { id: BigInt(stopId), routeId: route.id } });
    if (!stop) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Dayanacaq tapılmadı' });
    if (dto.day !== undefined) this.assertDay(route, dto.day);

    const moving = dto.day !== undefined && dto.day !== stop.dayNumber;
    let dayMove: { dayNumber: number; sortOrder: number; routeDayId: bigint | null } | null = null;
    if (moving) {
      // Yeni günün sonuna keçir — UNIQUE(route_id, day_number, sort_order) toqquşmasın
      const [max, routeDay] = await Promise.all([
        this.prisma.routeStop.aggregate({ where: { routeId: route.id, dayNumber: dto.day }, _max: { sortOrder: true } }),
        this.prisma.routeDay.findUnique({ where: { routeId_dayNumber: { routeId: route.id, dayNumber: dto.day! } } }),
      ]);
      dayMove = { dayNumber: dto.day!, sortOrder: (max._max.sortOrder ?? -1) + 1, routeDayId: routeDay?.id ?? null };
    }

    await this.prisma.routeStop.update({
      where: { id: stop.id },
      data: {
        ...(dayMove ?? {}),
        ...(dto.arriveTime !== undefined ? { arriveTime: dto.arriveTime } : {}),
        ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
        ...(dto.note !== undefined ? { noteAz: dto.note } : {}),
      },
    });

    if (dayMove) {
      await this.renumberDay(route.id, stop.dayNumber);
      await this.renumberDay(route.id, dayMove.dayNumber);
      await this.recomputeDistance(route.id);
    }
    return this.detail(slug, lang, userId);
  }

  async removeStop(userId: bigint, slug: string, stopId: number, lang: Lang) {
    const route = await this.loadOwned(slug, userId);
    const stop = await this.prisma.routeStop.findFirst({ where: { id: BigInt(stopId), routeId: route.id } });
    if (!stop) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Dayanacaq tapılmadı' });

    await this.prisma.routeStop.delete({ where: { id: stop.id } });
    await this.renumberDay(route.id, stop.dayNumber);

    await this.recomputeDistance(route.id);
    return this.detail(slug, lang, userId);
  }

  /** Ekran 50 — sürüklə-burax sıralaması. */
  async reorderStops(userId: bigint, slug: string, dto: ReorderStopsDto, lang: Lang) {
    const route = await this.loadOwned(slug, userId);
    for (const s of dto.stops) this.assertDay(route, s.day);
    const ids = dto.stops.map((s) => BigInt(s.stopId));
    const owned = await this.prisma.routeStop.count({ where: { routeId: route.id, id: { in: ids } } });
    if (owned !== ids.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Bəzi dayanacaqlar bu marşruta aid deyil',
      });
    }

    const days = await this.prisma.routeDay.findMany({ where: { routeId: route.id } });
    const dayId = new Map(days.map((d) => [d.dayNumber, d.id]));

    // UNIQUE(route_id, day_number, sort_order) toqquşmasın deyə iki mərhələ:
    // əvvəlcə istifadə olunmayan yüksək aralığa köçürürük. `sort_order`
    // UNSIGNED SMALLINT olduğu üçün mənfi dəyər olmaz — 10000+ istifadə edilir.
    const PARK = 10_000;
    await this.prisma.$transaction([
      ...dto.stops.map((s, i) =>
        this.prisma.routeStop.update({ where: { id: BigInt(s.stopId) }, data: { sortOrder: PARK + i } }),
      ),
      ...dto.stops.map((s) =>
        this.prisma.routeStop.update({
          where: { id: BigInt(s.stopId) },
          data: { dayNumber: s.day, sortOrder: s.order, routeDayId: dayId.get(s.day) ?? null },
        }),
      ),
    ]);

    for (const day of new Set(dto.stops.map((s) => s.day))) {
      await this.renumberDay(route.id, day);
    }
    await this.recomputeDistance(route.id);
    return this.detail(slug, lang, userId);
  }

  /** Ekran 14 "Kopyala" — başqasının marşrutunu öz siyahına götür. */
  async copy(userId: bigint, slug: string, lang: Lang) {
    const source = await this.prisma.route.findFirst({
      where: { slug, deletedAt: null, visibility: { in: ['public', 'official'] } },
      include: { translations: true, stops: { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }] } },
    });
    if (!source) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${slug}` });

    const az = source.translations.find((t) => t.lang === 'az');
    const newSlug = await this.uniqueSlug(`${az?.title ?? source.slug} kopyası`);

    const copy = await this.prisma.route.create({
      data: {
        publicId: ulid(),
        slug: newSlug,
        authorId: userId,
        regionId: source.regionId,
        days: source.days,
        nights: source.nights,
        distanceKm: source.distanceKm,
        difficulty: source.difficulty,
        categories: source.categories,
        coverId: source.coverId,
        visibility: 'private',
        translations: {
          create: source.translations.map((t) => ({
            lang: t.lang,
            title: t.lang === 'az' ? `${t.title} (kopya)` : t.title,
            description: t.description,
          })),
        },
        routeDays: { create: Array.from({ length: source.days }, (_, i) => ({ dayNumber: i + 1 })) },
      },
    });

    const newDays = await this.prisma.routeDay.findMany({ where: { routeId: copy.id } });
    const dayId = new Map(newDays.map((d) => [d.dayNumber, d.id]));

    if (source.stops.length) {
      await this.prisma.routeStop.createMany({
        data: source.stops.map((s) => ({
          routeId: copy.id,
          routeDayId: dayId.get(s.dayNumber) ?? null,
          placeId: s.placeId,
          dayNumber: s.dayNumber,
          sortOrder: s.sortOrder,
          arriveTime: s.arriveTime,
          durationMin: s.durationMin,
          noteAz: s.noteAz,
        })),
      });
    }

    await this.prisma.route.update({ where: { id: source.id }, data: { copyCount: { increment: 1 } } });
    return this.detail(copy.slug, lang, userId);
  }
}
