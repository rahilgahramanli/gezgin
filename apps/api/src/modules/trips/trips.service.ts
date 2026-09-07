import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TripItemType } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { XpService } from '@/modules/gamification/xp.service';
import type {
  AddDayDto, AddNoteDto, AddTripItemDto, CreateTripDto, ListTripsDto,
  ReorderTripItemsDto, UpdateTripDto, UpdateTripItemDto,
} from './dto/trips.dto';

type Lang = 'az' | 'en' | 'ru';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly xp: XpService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private async loadOwned(publicId: string, userId: bigint) {
    const trip = await this.prisma.trip.findFirst({ where: { publicId, deletedAt: null } });
    if (!trip) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Səyahət tapılmadı' });
    if (trip.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu səyahət sizə aid deyil' });
    }
    return trip;
  }

  /** Gün sayı tarixlərdən, yoxsa mövcud elementlərdən çıxarılır. */
  private dayCount(trip: { startDate: Date | null; endDate: Date | null }, fallback = 1): number {
    if (trip.startDate && trip.endDate) {
      const diff = Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400_000) + 1;
      return Math.max(1, Math.min(60, diff));
    }
    return fallback;
  }

  /**
   * Bir günün elementlərini 0-dan ardıcıl nömrələyir.
   * Əlavə/silmə/sıralamadan sonra çağırılır — beləliklə sıra dəyərləri
   * həmişə [0, 1, 2, …] olur və mənbədən asılı olmur (marşrutdan köçürülən
   * dayanacaqlar 1-dən başlaya bilər).
   */
  private async renumberDay(tripId: bigint, tripDayId: bigint | null): Promise<void> {
    const items = await this.prisma.tripItem.findMany({
      where: { tripId, tripDayId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    await this.prisma.$transaction(
      items.map((item, index) =>
        this.prisma.tripItem.update({ where: { id: item.id }, data: { sortOrder: index } }),
      ),
    );
  }

  private async ensureDays(tripId: bigint, upTo: number, startDate: Date | null): Promise<Map<number, bigint>> {
    const existing = await this.prisma.tripDay.findMany({ where: { tripId } });
    const have = new Map(existing.map((d) => [d.dayNumber, d.id]));

    for (let day = 1; day <= upTo; day++) {
      if (have.has(day)) continue;
      const created = await this.prisma.tripDay.create({
        data: {
          tripId,
          dayNumber: day,
          date: startDate ? new Date(startDate.getTime() + (day - 1) * 86400_000) : null,
        },
      });
      have.set(day, created.id);
    }
    return have;
  }

  // ─────────────────── oxu ───────────────────

  /** Ekran 23 — səyahət siyahısı, aktiv olan öndə. */
  async list(userId: bigint, dto: ListTripsDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statusFilter: Prisma.TripWhereInput =
      dto.status === 'upcoming'
        ? { status: { in: ['planned', 'active'] }, OR: [{ endDate: null }, { endDate: { gte: today } }] }
        : dto.status === 'past'
          ? { OR: [{ status: 'completed' }, { endDate: { lt: today } }] }
          : dto.status
            ? { status: dto.status as Prisma.EnumTripStatusFilter['equals'] }
            : {};

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.trip.findMany({
      where: { userId, deletedAt: null, ...statusFilter },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: {
        cover: { select: { storageKey: true, blurhash: true } },
        route: { select: { slug: true, translations: { where: { lang: 'az' }, select: { title: true } } } },
        _count: { select: { items: true, days: true } },
      },
    });

    const ids = rows.map((r) => r.id);
    const doneCounts = ids.length
      ? await this.prisma.tripItem.groupBy({ by: ['tripId'], where: { tripId: { in: ids }, isDone: true }, _count: true })
      : [];
    const doneByTrip = new Map(doneCounts.map((d) => [d.tripId.toString(), d._count]));

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((t) => {
        const done = doneByTrip.get(t.id.toString()) ?? 0;
        return {
          publicId: t.publicId,
          title: t.title,
          status: t.status,
          startDate: t.startDate,
          endDate: t.endDate,
          travelers: t.travelers,
          dayCount: t._count.days,
          itemCount: t._count.items,
          doneCount: done,
          progressPercent: t._count.items ? Math.round((done / t._count.items) * 100) : 0,
          offlineEnabled: t.offlineEnabled,
          coverUrl: this.url(t.cover?.storageKey),
          fromRoute: t.route ? { slug: t.route.slug, title: t.route.translations[0]?.title ?? t.route.slug } : null,
        };
      }),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 23 — gün-gün plan, xəritə nöqtələri və tərəqqi. */
  async detail(publicId: string, userId: bigint, lang: Lang) {
    const trip = await this.prisma.trip.findFirst({
      where: { publicId, deletedAt: null },
      include: {
        cover: { select: { storageKey: true, blurhash: true } },
        route: { select: { slug: true, translations: { where: { lang: 'az' }, select: { title: true } } } },
        days: { orderBy: { dayNumber: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        items: {
          orderBy: [{ tripDayId: 'asc' }, { sortOrder: 'asc' }],
          include: {
            place: {
              include: {
                translations: { select: { lang: true, name: true } },
                photos: {
                  where: { media: { deletedAt: null } },
                  include: { media: { select: { storageKey: true } } },
                  orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
                  take: 1,
                },
              },
            },
            experience: {
              include: {
                photos: {
                  where: { media: { deletedAt: null } },
                  include: { media: { select: { storageKey: true } } },
                  orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
                  take: 1,
                },
              },
            },
            event: { include: { cover: { select: { storageKey: true } } } },
            booking: { select: { publicId: true, code: true, status: true } },
          },
        },
      },
    });
    if (!trip) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Səyahət tapılmadı' });
    if (trip.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu səyahət sizə aid deyil' });
    }

    const dayById = new Map(trip.days.map((d) => [d.id.toString(), d.dayNumber]));
    const byDay = new Map<number, typeof trip.items>();
    for (const item of trip.items) {
      const day = item.tripDayId ? (dayById.get(item.tripDayId.toString()) ?? 1) : 1;
      const list = byDay.get(day) ?? [];
      list.push(item);
      byDay.set(day, list);
    }

    const shapeItem = (item: (typeof trip.items)[number]) => {
      const place = item.place;
      const pt = place?.translations.find((x) => x.lang === lang) ?? place?.translations.find((x) => x.lang === 'az');
      const target =
        item.type === 'place' && place
          ? {
              slug: place.slug,
              name: pt?.name ?? place.slug,
              lat: Number(place.lat),
              lng: Number(place.lng),
              rating: Number(place.ratingAvg),
              imageUrl: this.url(place.photos[0]?.media.storageKey),
            }
          : item.type === 'experience' && item.experience
            ? {
                slug: item.experience.slug,
                name: item.experience.titleAz,
                lat: item.experience.lat === null ? null : Number(item.experience.lat),
                lng: item.experience.lng === null ? null : Number(item.experience.lng),
                priceAzn: Number(item.experience.priceAzn),
                imageUrl: this.url(item.experience.photos[0]?.media.storageKey),
              }
            : item.type === 'event' && item.event
              ? {
                  slug: item.event.slug,
                  name: item.event.titleAz,
                  lat: item.event.lat === null ? null : Number(item.event.lat),
                  lng: item.event.lng === null ? null : Number(item.event.lng),
                  startDate: item.event.startDate,
                  imageUrl: this.url(item.event.cover?.storageKey),
                }
              : { slug: null, name: item.customTitle ?? 'Qeyd', lat: null, lng: null, imageUrl: null };

      return {
        itemId: Number(item.id),
        type: item.type,
        order: item.sortOrder,
        startTime: item.startTime,
        durationMin: item.durationMin,
        note: item.noteAz,
        isDone: item.isDone,
        doneAt: item.doneAt,
        booking: item.booking ? { publicId: item.booking.publicId, code: item.booking.code, status: item.booking.status } : null,
        target,
      };
    };

    const done = trip.items.filter((i) => i.isDone).length;
    const dayCount = Math.max(trip.days.length, 1);

    // Xəritə üçün koordinatı olan elementlər — ekran 23-dəki marşrut xətti
    const mapPoints = trip.items
      .map(shapeItem)
      .filter((i) => i.target.lat !== null && i.target.lng !== null)
      .map((i) => ({ name: i.target.name, lat: i.target.lat, lng: i.target.lng, isDone: i.isDone }));

    return {
      publicId: trip.publicId,
      title: trip.title,
      status: trip.status,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelers: trip.travelers,
      offlineEnabled: trip.offlineEnabled,
      startedAt: trip.startedAt,
      completedAt: trip.completedAt,
      coverUrl: this.url(trip.cover?.storageKey),
      fromRoute: trip.route ? { slug: trip.route.slug, title: trip.route.translations[0]?.title ?? trip.route.slug } : null,
      progress: {
        done,
        total: trip.items.length,
        percent: trip.items.length ? Math.round((done / trip.items.length) * 100) : 0,
      },
      itinerary: Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => {
        const dayRow = trip.days.find((d) => d.dayNumber === day);
        return {
          day,
          dayId: dayRow ? Number(dayRow.id) : null,
          date: dayRow?.date ?? null,
          title: dayRow?.titleAz ?? null,
          items: (byDay.get(day) ?? []).map(shapeItem),
        };
      }),
      mapPoints,
      notes: trip.notes.map((n) => ({ id: Number(n.id), body: n.body, createdAt: n.createdAt })),
    };
  }

  // ─────────────────── yazma ───────────────────

  /** Ekran 24 — sıfırdan və ya hazır marşrutdan. */
  async create(userId: bigint, dto: CreateTripDto, lang: Lang) {
    let coverId: bigint | null = null;
    if (dto.coverMediaPublicId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: dto.coverMediaPublicId } });
      if (!media || media.ownerId !== userId) {
        throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Cover media tapılmadı' });
      }
      coverId = media.id;
    }

    const route = dto.fromRoute
      ? await this.prisma.route.findFirst({
          where: { slug: dto.fromRoute, deletedAt: null },
          include: { stops: { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }] }, cover: true },
        })
      : null;
    if (dto.fromRoute && !route) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${dto.fromRoute}` });
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    let endDate = dto.endDate ? new Date(dto.endDate) : null;

    // Marşrutdan gəlirsə və bitmə tarixi verilməyibsə, marşrutun gün sayına görə hesablanır
    if (route && startDate && !endDate) {
      endDate = new Date(startDate.getTime() + (route.days - 1) * 86400_000);
    }
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Bitmə tarixi başlanğıcdan əvvəl ola bilməz',
      });
    }

    const trip = await this.prisma.trip.create({
      data: {
        publicId: ulid(),
        userId,
        title: dto.title,
        routeId: route?.id ?? null,
        startDate,
        endDate,
        travelers: dto.travelers ?? 1,
        offlineEnabled: dto.offlineEnabled ?? false,
        coverId: coverId ?? route?.coverId ?? null,
      },
    });

    const days = route ? route.days : this.dayCount({ startDate, endDate });
    const dayMap = await this.ensureDays(trip.id, days, startDate);

    // Marşrutun dayanacaqları plan elementlərinə çevrilir
    if (route?.stops.length) {
      await this.prisma.tripItem.createMany({
        data: route.stops.map((s, index) => ({
          tripId: trip.id,
          tripDayId: dayMap.get(s.dayNumber) ?? null,
          type: 'place' as TripItemType,
          placeId: s.placeId,
          startTime: s.arriveTime,
          durationMin: s.durationMin,
          // Marşrutun öz sıraları 1-dən başlaya bilər — gün daxilində 0-dan nömrələyirik
          sortOrder: route.stops.filter((x, i) => x.dayNumber === s.dayNumber && i < index).length,
          noteAz: s.noteAz,
        })),
      });
    }

    return this.detail(trip.publicId, userId, lang);
  }

  async update(userId: bigint, publicId: string, dto: UpdateTripDto, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);

    let coverId: bigint | undefined;
    if (dto.coverMediaPublicId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: dto.coverMediaPublicId } });
      if (!media || media.ownerId !== userId) {
        throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Cover media tapılmadı' });
      }
      coverId = media.id;
    }

    const startDate = dto.startDate !== undefined ? new Date(dto.startDate) : trip.startDate;
    const endDate = dto.endDate !== undefined ? new Date(dto.endDate) : trip.endDate;
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Bitmə tarixi başlanğıcdan əvvəl ola bilməz',
      });
    }

    await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.travelers !== undefined ? { travelers: dto.travelers } : {}),
        ...(dto.offlineEnabled !== undefined ? { offlineEnabled: dto.offlineEnabled } : {}),
        ...(coverId !== undefined ? { coverId } : {}),
      },
    });

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      const existing = await this.prisma.tripDay.count({ where: { tripId: trip.id } });
      await this.ensureDays(trip.id, Math.max(existing, this.dayCount({ startDate, endDate }, existing || 1)), startDate);
    }

    return this.detail(publicId, userId, lang);
  }

  async remove(userId: bigint, publicId: string) {
    const trip = await this.loadOwned(publicId, userId);
    await this.prisma.trip.update({ where: { id: trip.id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async addDay(userId: bigint, publicId: string, dto: AddDayDto, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    const max = await this.prisma.tripDay.aggregate({ where: { tripId: trip.id }, _max: { dayNumber: true } });
    const dayNumber = (max._max.dayNumber ?? 0) + 1;
    if (dayNumber > 60) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Maksimum 60 gün' });
    }

    await this.prisma.tripDay.create({
      data: {
        tripId: trip.id,
        dayNumber,
        titleAz: dto.title ?? null,
        date: dto.date
          ? new Date(dto.date)
          : trip.startDate
            ? new Date(trip.startDate.getTime() + (dayNumber - 1) * 86400_000)
            : null,
      },
    });
    return this.detail(publicId, userId, lang);
  }

  async removeDay(userId: bigint, publicId: string, dayId: number, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    const day = await this.prisma.tripDay.findFirst({ where: { id: BigInt(dayId), tripId: trip.id } });
    if (!day) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Gün tapılmadı' });

    // Günün elementləri silinmir — sahibsiz qalmasın deyə əvvəlki günə keçir
    const previous = await this.prisma.tripDay.findFirst({
      where: { tripId: trip.id, dayNumber: { lt: day.dayNumber } },
      orderBy: { dayNumber: 'desc' },
    });
    await this.prisma.tripItem.updateMany({
      where: { tripDayId: day.id },
      data: { tripDayId: previous?.id ?? null },
    });
    await this.prisma.tripDay.delete({ where: { id: day.id } });
    await this.prisma.tripDay.updateMany({
      where: { tripId: trip.id, dayNumber: { gt: day.dayNumber } },
      data: { dayNumber: { decrement: 1 } },
    });

    return this.detail(publicId, userId, lang);
  }

  /** Ekran 48 — "Plana əlavə et". */
  async addItem(userId: bigint, publicId: string, dto: AddTripItemDto, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    const day = dto.day ?? 1;
    const dayMap = await this.ensureDays(trip.id, day, trip.startDate);
    const tripDayId = dayMap.get(day) ?? null;

    let placeId: bigint | null = null;
    let experienceId: bigint | null = null;
    let eventId: bigint | null = null;

    if (dto.type !== 'custom') {
      if (!dto.slug) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: `type=${dto.type} üçün slug tələb olunur`,
        });
      }
      if (dto.type === 'place') {
        const row = await this.prisma.place.findFirst({ where: { slug: dto.slug, deletedAt: null }, select: { id: true } });
        if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.slug}` });
        placeId = row.id;
      } else if (dto.type === 'experience') {
        const row = await this.prisma.experience.findFirst({ where: { slug: dto.slug, deletedAt: null }, select: { id: true } });
        if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${dto.slug}` });
        experienceId = row.id;
      } else {
        const row = await this.prisma.event.findFirst({ where: { slug: dto.slug, deletedAt: null }, select: { id: true } });
        if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Tədbir tapılmadı: ${dto.slug}` });
        eventId = row.id;
      }
    } else if (!dto.title) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'type=custom üçün title tələb olunur' });
    }

    const max = await this.prisma.tripItem.aggregate({
      where: { tripId: trip.id, tripDayId },
      _max: { sortOrder: true },
    });

    await this.prisma.tripItem.create({
      data: {
        tripId: trip.id,
        tripDayId,
        type: dto.type,
        placeId,
        experienceId,
        eventId,
        customTitle: dto.type === 'custom' ? (dto.title ?? null) : null,
        startTime: dto.startTime ?? null,
        durationMin: dto.durationMin ?? null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        noteAz: dto.note ?? null,
      },
    });

    await this.renumberDay(trip.id, tripDayId);
    return this.detail(publicId, userId, lang);
  }

  async updateItem(userId: bigint, publicId: string, itemId: number, dto: UpdateTripItemDto, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    const item = await this.prisma.tripItem.findFirst({ where: { id: BigInt(itemId), tripId: trip.id } });
    if (!item) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Element tapılmadı' });

    let tripDayId = item.tripDayId;
    if (dto.day !== undefined) {
      const dayMap = await this.ensureDays(trip.id, dto.day, trip.startDate);
      tripDayId = dayMap.get(dto.day) ?? null;
    }

    await this.prisma.tripItem.update({
      where: { id: item.id },
      data: {
        ...(dto.day !== undefined ? { tripDayId } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
        ...(dto.note !== undefined ? { noteAz: dto.note } : {}),
        ...(dto.isDone !== undefined ? { isDone: dto.isDone, doneAt: dto.isDone ? new Date() : null } : {}),
      },
    });

    return this.detail(publicId, userId, lang);
  }

  async removeItem(userId: bigint, publicId: string, itemId: number, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    const item = await this.prisma.tripItem.findFirst({ where: { id: BigInt(itemId), tripId: trip.id } });
    if (!item) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Element tapılmadı' });

    await this.prisma.tripItem.delete({ where: { id: item.id } });
    await this.renumberDay(trip.id, item.tripDayId);

    return this.detail(publicId, userId, lang);
  }

  async reorderItems(userId: bigint, publicId: string, dto: ReorderTripItemsDto, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    const ids = dto.items.map((i) => BigInt(i.itemId));
    const owned = await this.prisma.tripItem.count({ where: { tripId: trip.id, id: { in: ids } } });
    if (owned !== ids.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Bəzi elementlər bu səyahətə aid deyil',
      });
    }

    const maxDay = Math.max(...dto.items.map((i) => i.day));
    const dayMap = await this.ensureDays(trip.id, maxDay, trip.startDate);

    // `trip_items`-də UNIQUE yoxdur, amma sıra dəyərləri təmiz qalsın deyə
    // marşrutdakı kimi iki mərhələli köçürmə tətbiq edilir.
    const PARK = 10_000;
    await this.prisma.$transaction([
      ...dto.items.map((i, idx) =>
        this.prisma.tripItem.update({ where: { id: BigInt(i.itemId) }, data: { sortOrder: PARK + idx } }),
      ),
      ...dto.items.map((i) =>
        this.prisma.tripItem.update({
          where: { id: BigInt(i.itemId) },
          data: { sortOrder: i.order, tripDayId: dayMap.get(i.day) ?? null },
        }),
      ),
    ]);

    // Müştəri boşluqlu sıra göndərə bilər (0, 2, 5) — normallaşdırırıq
    for (const dayId of new Set(dto.items.map((i) => dayMap.get(i.day) ?? null))) {
      await this.renumberDay(trip.id, dayId);
    }

    return this.detail(publicId, userId, lang);
  }

  /** Ekran 15/23 "Marşrutu başlat" → aktiv səyahət. */
  async start(userId: bigint, publicId: string, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    if (trip.status === 'completed') {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Səyahət artıq tamamlanıb' });
    }

    // Eyni anda yalnız bir aktiv səyahət — ekran 23 tək "Aktiv" nişanı göstərir
    await this.prisma.trip.updateMany({
      where: { userId, status: 'active', id: { not: trip.id } },
      data: { status: 'planned' },
    });
    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: 'active', startedAt: trip.startedAt ?? new Date() },
    });

    return this.detail(publicId, userId, lang);
  }

  async complete(userId: bigint, publicId: string, lang: Lang) {
    const trip = await this.loadOwned(publicId, userId);
    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Yalnız ilk tamamlanmada XP verilir
    const reward =
      trip.completedAt === null
        ? await this.xp.award(userId, 'trip_completed', { type: 'trip', id: trip.id, note: trip.title })
        : null;

    return { ...(await this.detail(publicId, userId, lang)), rewards: reward };
  }

  async addNote(userId: bigint, publicId: string, dto: AddNoteDto) {
    const trip = await this.loadOwned(publicId, userId);
    const note = await this.prisma.tripNote.create({ data: { tripId: trip.id, body: dto.body } });
    return { id: Number(note.id), body: note.body, createdAt: note.createdAt };
  }
}
