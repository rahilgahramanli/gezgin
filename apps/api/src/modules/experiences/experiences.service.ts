import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES, PLATFORM_COMMISSION_RATE, EXPERT_PAYOUT_RATE, XP_RULES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { toBooleanQuery } from '@/common/search/normalize';
import { BookingLifecycleService } from '@/modules/bookings/booking-lifecycle.service';
import { CATEGORY_NAME_SELECT, INCLUSIONS, categoryName, inclusionName, titleFor } from '@/common/i18n';
import type {
  AvailabilityDto, CreateExperienceDto, CreateSlotsDto, ListExperiencesDto, UpdateExperienceDto,
} from './dto/experiences.dto';

type Lang = 'az' | 'en' | 'ru';

@Injectable()
export class ExperiencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly lifecycle: BookingLifecycleService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const clean =
      base.toLowerCase()
        .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
        .replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'tecrube';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? clean : `${clean}-${i}`;
      const taken = await this.prisma.experience.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${clean}-${Date.now().toString(36)}`;
  }

  private async loadOwned(slug: string, userId: bigint) {
    const exp = await this.prisma.experience.findFirst({ where: { slug, deletedAt: null } });
    if (!exp) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${slug}` });
    if (exp.expertId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu təcrübə sizə aid deyil' });
    }
    return exp;
  }

  /** Ekran 17 və 56 — 80/20 bölgüsü şəffaf göstərilir. */
  private priceBreakdown(priceAzn: number, payoutRate: number) {
    const expert = Math.round(priceAzn * payoutRate * 100) / 100;
    return {
      priceAzn,
      expertEarnsAzn: expert,
      platformFeeAzn: Math.round((priceAzn - expert) * 100) / 100,
      expertRate: payoutRate,
      platformRate: Math.round((1 - payoutRate) * 1000) / 1000,
    };
  }

  private async setPhotos(experienceId: bigint, ownerId: bigint, mediaPublicIds: string[]) {
    const media = await this.prisma.mediaAsset.findMany({
      where: { publicId: { in: mediaPublicIds }, ownerId, status: 'ready', deletedAt: null },
    });
    if (media.length !== mediaPublicIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Bəzi fotolar tapılmadı və ya sizə aid deyil',
      });
    }
    const byPublicId = new Map(media.map((m) => [m.publicId, m.id]));
    await this.prisma.experiencePhoto.deleteMany({ where: { experienceId } });
    await this.prisma.experiencePhoto.createMany({
      data: mediaPublicIds.map((pid, i) => ({
        experienceId,
        mediaId: byPublicId.get(pid)!,
        isCover: i === 0,
        sortOrder: i,
      })),
    });
  }

  private async setInclusions(experienceId: bigint, codes: string[]) {
    await this.prisma.experienceInclusion.deleteMany({ where: { experienceId } });
    if (!codes.length) return;
    await this.prisma.experienceInclusion.createMany({
      // Ekran 17, 56 — "Qiymətə daxildir"; ad bazada az saxlanılır, oxunanda koda görə çevrilir
      data: codes.map((code) => ({ experienceId, code, nameAz: INCLUSIONS[code]?.az ?? code })),
    });
  }

  // ─────────────────── oxu ───────────────────

  async list(dto: ListExperiencesDto, lang: Lang) {
    const where: Prisma.ExperienceWhereInput = {
      deletedAt: null,
      status: 'published',
      ...(dto.region ? { region: { slug: dto.region } } : {}),
      ...(dto.duration ? { duration: dto.duration } : {}),
      ...(dto.maxPrice !== undefined ? { priceAzn: { lte: dto.maxPrice } } : {}),
      ...(dto.minRating !== undefined ? { ratingAvg: { gte: dto.minRating } } : {}),
      ...(dto.expert ? { expert: { username: dto.expert } } : {}),
      ...(dto.categories?.length ? { category: { slug: { in: dto.categories } } } : {}),
    };

    if (dto.q) {
      const bq = toBooleanQuery(dto.q);
      if (bq) {
        const ids = await this.prisma.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM experiences
          WHERE MATCH(search_text) AGAINST(${bq} IN BOOLEAN MODE) LIMIT 200
        `;
        where.id = { in: ids.map((i) => i.id) };
      } else {
        where.id = { in: [] };
      }
    }

    const orderBy: Prisma.ExperienceOrderByWithRelationInput[] = {
      popular: [{ isFeatured: 'desc' as const }, { bookingCount: 'desc' as const }],
      rating: [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }],
      price_asc: [{ priceAzn: 'asc' as const }],
      price_desc: [{ priceAzn: 'desc' as const }],
      newest: [{ createdAt: 'desc' as const }],
    }[dto.sort ?? 'popular'];

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.experience.findMany({
      where,
      orderBy: [...orderBy, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: {
        region: { include: { translations: { select: { lang: true, name: true } } } },
        category: { select: { slug: true, ...CATEGORY_NAME_SELECT } },
        expert: { select: { username: true, fullName: true, avatar: { select: { storageKey: true } } } },
        photos: {
          where: { media: { deletedAt: null } },
          include: { media: { select: { storageKey: true, blurhash: true } } },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
      },
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((e) => {
        const rt = e.region.translations.find((x) => x.lang === lang) ?? e.region.translations.find((x) => x.lang === 'az');
        return {
          slug: e.slug,
          title: titleFor(e, lang),
          duration: e.duration,
          durationText: e.durationText,
          priceAzn: Number(e.priceAzn),
          maxGroup: e.maxGroup,
          rating: Number(e.ratingAvg),
          ratingCount: e.ratingCount,
          bookingCount: e.bookingCount,
          isFeatured: e.isFeatured,
          category: e.category ? { slug: e.category.slug, name: categoryName(e.category, lang) } : null,
          region: { slug: e.region.slug, name: rt?.name ?? e.region.slug },
          expert: {
            username: e.expert.username,
            fullName: e.expert.fullName,
            avatarUrl: this.url(e.expert.avatar?.storageKey),
          },
          coverUrl: this.url(e.photos[0]?.media.storageKey),
          blurhash: e.photos[0]?.media.blurhash ?? null,
        };
      }),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 17 — təcrübə detalı. */
  /** Baxan istifadəçi təcrübəni saxlayıbmı. */
  private async isSavedByViewer(viewerId: bigint | undefined, experienceId: bigint): Promise<boolean> {
    if (viewerId === undefined) return false;
    const count = await this.prisma.savedItem.count({
      where: { userId: viewerId, targetType: 'experience', targetId: experienceId },
    });
    return count > 0;
  }

  async detail(slug: string, lang: Lang, viewerId?: bigint) {
    const exp = await this.prisma.experience.findFirst({
      where: { slug, deletedAt: null },
      include: {
        region: { include: { translations: { select: { lang: true, name: true } } } },
        place: { include: { translations: { select: { lang: true, name: true } } } },
        category: { select: { slug: true, ...CATEGORY_NAME_SELECT, icon: true } },
        expert: {
          select: {
            username: true, fullName: true, bio: true, level: true,
            avatar: { select: { storageKey: true } },
            expertProfile: { select: { ratingAvg: true, ratingCount: true, experienceCount: true, languages: true, payoutRate: true } },
          },
        },
        inclusions: { orderBy: { id: 'asc' } },
        photos: {
          where: { media: { deletedAt: null } },
          include: { media: { select: { storageKey: true, blurhash: true, width: true, height: true } } },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        },
        _count: { select: { bookings: true } },
      },
    });
    if (!exp) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${slug}` });

    const isOwner = viewerId !== undefined && exp.expertId === viewerId;
    if (exp.status !== 'published' && !isOwner) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${slug}` });
    }

    const rt = exp.region.translations.find((x) => x.lang === lang) ?? exp.region.translations.find((x) => x.lang === 'az');
    const pt = exp.place?.translations.find((x) => x.lang === lang) ?? exp.place?.translations.find((x) => x.lang === 'az');
    const payoutRate = Number(exp.expert.expertProfile?.payoutRate ?? EXPERT_PAYOUT_RATE);

    const reviewCount = await this.prisma.review.count({
      where: { targetType: 'experience', targetId: exp.id, deletedAt: null, isVisible: true },
    });

    const nextSlot = await this.prisma.experienceSlot.findFirst({
      where: { experienceId: exp.id, isCancelled: false, startAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
      select: { startAt: true, capacity: true, booked: true },
    });

    return {
      slug: exp.slug,
      title: titleFor(exp, lang),
      titleEn: exp.titleEn,
      description: exp.descriptionAz,
      status: exp.status,
      isOwner,
      // Ekran 17 "saxla" düyməsi vəziyyəti göstərsin
      isSaved: await this.isSavedByViewer(viewerId, exp.id),
      duration: exp.duration,
      durationText: exp.durationText,
      maxGroup: exp.maxGroup,
      minGroup: exp.minGroup,
      meetingPoint: exp.meetingPoint,
      lat: exp.lat === null ? null : Number(exp.lat),
      lng: exp.lng === null ? null : Number(exp.lng),
      rating: Number(exp.ratingAvg),
      ratingCount: exp.ratingCount,
      reviewCount,
      bookingCount: exp._count.bookings,
      pricing: this.priceBreakdown(Number(exp.priceAzn), payoutRate),
      /** Ekran 17 "Gezgin qazancı" bloku. */
      gezginRewards: {
        experienceXp: XP_RULES.experience_completed.xp,
        bookingXp: XP_RULES.booking_completed.xp,
        reviewXp: XP_RULES.review_written.xp,
        region: { slug: exp.region.slug, name: rt?.name ?? exp.region.slug },
      },
      region: { slug: exp.region.slug, name: rt?.name ?? exp.region.slug },
      place: exp.place ? { slug: exp.place.slug, name: pt?.name ?? exp.place.slug } : null,
      category: exp.category ? { slug: exp.category.slug, name: categoryName(exp.category, lang), icon: exp.category.icon } : null,
      includes: exp.inclusions.map((i) => ({ code: i.code, name: inclusionName(i.code, i.nameAz, lang), icon: i.icon })),
      photos: exp.photos.map((p) => ({
        url: this.url(p.media.storageKey),
        blurhash: p.media.blurhash,
        width: p.media.width,
        height: p.media.height,
      })),
      expert: {
        username: exp.expert.username,
        fullName: exp.expert.fullName,
        bio: exp.expert.bio,
        level: exp.expert.level,
        avatarUrl: this.url(exp.expert.avatar?.storageKey),
        rating: Number(exp.expert.expertProfile?.ratingAvg ?? 0),
        ratingCount: exp.expert.expertProfile?.ratingCount ?? 0,
        experienceCount: exp.expert.expertProfile?.experienceCount ?? 0,
        languages: exp.expert.expertProfile?.languages?.split('|') ?? [],
      },
      nextAvailable: nextSlot
        ? { startAt: nextSlot.startAt, seatsLeft: Math.max(0, nextSlot.capacity - nextSlot.booked) }
        : null,
    };
  }

  /** Ekran 18 tarix seçici — boş yerlərlə birlikdə. */
  async availability(slug: string, dto: AvailabilityDto) {
    // Ödəniş vaxtı bitmiş bronların yerləri əvvəlcə boşalsın — əks halda slot "dolu" görünür
    await this.lifecycle.sweep();

    const exp = await this.prisma.experience.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, maxGroup: true, priceAzn: true },
    });
    if (!exp) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${slug}` });

    const from = dto.from ? new Date(dto.from) : new Date();
    const to = new Date(from.getTime() + (dto.days ?? 30) * 86400_000);

    const slots = await this.prisma.experienceSlot.findMany({
      where: { experienceId: exp.id, isCancelled: false, startAt: { gte: from, lte: to } },
      orderBy: { startAt: 'asc' },
    });

    return {
      defaultPriceAzn: Number(exp.priceAzn),
      slots: slots.map((s) => ({
        slotId: Number(s.id),
        startAt: s.startAt,
        endAt: s.endAt,
        capacity: s.capacity,
        booked: s.booked,
        seatsLeft: Math.max(0, s.capacity - s.booked),
        isFull: s.booked >= s.capacity,
        priceAzn: s.priceAzn === null ? Number(exp.priceAzn) : Number(s.priceAzn),
      })),
    };
  }

  /** Ekran 21 — Local Expert profili. */
  async expertProfile(username: string, lang: Lang) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null, status: 'active' },
      include: {
        avatar: { select: { storageKey: true } },
        cover: { select: { storageKey: true } },
        homeRegion: { include: { translations: { select: { lang: true, name: true } } } },
        expertProfile: true,
      },
    });
    if (!user || user.role !== 'local_expert' || !user.expertProfile) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Local Expert tapılmadı: ${username}` });
    }

    const p = user.expertProfile;
    const experiences = await this.list({ expert: username, sort: 'rating', limit: 20 }, lang);
    const rt = user.homeRegion?.translations.find((x) => x.lang === lang) ?? user.homeRegion?.translations.find((x) => x.lang === 'az');

    const yearsActive =
      p.yearsActive ??
      (p.approvedAt ? Math.max(1, new Date().getFullYear() - p.approvedAt.getFullYear()) : null);

    return {
      username: user.username,
      fullName: user.fullName,
      bio: p.bioAz ?? user.bio,
      headline: p.headlineAz,
      level: user.level,
      avatarUrl: this.url(user.avatar?.storageKey),
      coverUrl: this.url(user.cover?.storageKey),
      region: user.homeRegion ? { slug: user.homeRegion.slug, name: rt?.name ?? user.homeRegion.slug } : null,
      stats: {
        rating: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        experienceCount: p.experienceCount,
        yearsActive,
      },
      specialties: p.specialties?.split('|') ?? [],
      languages: p.languages?.split('|') ?? [],
      regions: p.regions?.split('|') ?? [],
      isAcceptingBookings: p.isAcceptingBookings,
      experiences: experiences.data,
    };
  }

  // ─────────────────── yazma (Local Expert) ───────────────────

  private async assertExpert(userId: bigint) {
    const profile = await this.prisma.expertProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new ForbiddenException({
        code: ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Təcrübə yaratmaq üçün Local Expert olmalısınız',
      });
    }
    return profile;
  }

  async create(userId: bigint, dto: CreateExperienceDto, lang: Lang) {
    await this.assertExpert(userId);

    const region = await this.prisma.region.findUnique({ where: { slug: dto.region }, select: { id: true } });
    if (!region) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Region tapılmadı: ${dto.region}` });

    const place = dto.place
      ? await this.prisma.place.findUnique({ where: { slug: dto.place }, select: { id: true } })
      : null;
    const category = dto.category
      ? await this.prisma.category.findUnique({ where: { slug: dto.category }, select: { id: true } })
      : null;

    const slug = await this.uniqueSlug(dto.title);
    const exp = await this.prisma.experience.create({
      data: {
        publicId: ulid(),
        slug,
        expertId: userId,
        regionId: region.id,
        placeId: place?.id ?? null,
        categoryId: category?.id ?? null,
        status: 'draft', // yayımlanana qədər gizli — ekran 56 "Qaralama"
        titleAz: dto.title,
        descriptionAz: dto.description ?? null,
        duration: dto.duration,
        priceAzn: new Prisma.Decimal(dto.priceAzn),
        maxGroup: dto.maxGroup ?? 10,
        meetingPoint: dto.meetingPoint ?? null,
        lat: dto.lat === undefined ? null : new Prisma.Decimal(dto.lat),
        lng: dto.lng === undefined ? null : new Prisma.Decimal(dto.lng),
      },
    });

    if (dto.includes?.length) await this.setInclusions(exp.id, dto.includes);
    if (dto.photoMediaPublicIds?.length) await this.setPhotos(exp.id, userId, dto.photoMediaPublicIds);

    return this.detail(exp.slug, lang, userId);
  }

  async update(userId: bigint, slug: string, dto: UpdateExperienceDto, lang: Lang) {
    const exp = await this.loadOwned(slug, userId);

    await this.prisma.experience.update({
      where: { id: exp.id },
      data: {
        ...(dto.title !== undefined ? { titleAz: dto.title } : {}),
        ...(dto.description !== undefined ? { descriptionAz: dto.description } : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.priceAzn !== undefined ? { priceAzn: new Prisma.Decimal(dto.priceAzn) } : {}),
        ...(dto.maxGroup !== undefined ? { maxGroup: dto.maxGroup } : {}),
        ...(dto.meetingPoint !== undefined ? { meetingPoint: dto.meetingPoint } : {}),
      },
    });

    if (dto.includes) await this.setInclusions(exp.id, dto.includes);
    if (dto.photoMediaPublicIds) await this.setPhotos(exp.id, userId, dto.photoMediaPublicIds);

    return this.detail(slug, lang, userId);
  }

  /** Ekran 56 son addım — qaralamanı yayımla. */
  async publish(userId: bigint, slug: string, lang: Lang) {
    const exp = await this.loadOwned(slug, userId);

    const photoCount = await this.prisma.experiencePhoto.count({ where: { experienceId: exp.id } });
    const missing: string[] = [];
    if (photoCount === 0) missing.push('ən azı 1 foto');
    if (!exp.descriptionAz || exp.descriptionAz.length < 20) missing.push('təsvir (ən azı 20 simvol)');
    if (!exp.meetingPoint) missing.push('görüş yeri');
    if (Number(exp.priceAzn) <= 0) missing.push('qiymət');

    if (missing.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Yayımlamaq üçün tamamlanmalıdır: ${missing.join(', ')}`,
        details: missing,
      });
    }

    await this.prisma.experience.update({ where: { id: exp.id }, data: { status: 'published' } });
    await this.prisma.expertProfile.update({
      where: { userId },
      data: { experienceCount: await this.prisma.experience.count({ where: { expertId: userId, status: 'published', deletedAt: null } }) },
    });

    return this.detail(slug, lang, userId);
  }

  async remove(userId: bigint, slug: string) {
    const exp = await this.loadOwned(slug, userId);
    const upcoming = await this.prisma.booking.count({
      where: { experienceId: exp.id, status: { in: ['confirmed', 'pending', 'awaiting_payment'] }, startAt: { gte: new Date() } },
    });
    if (upcoming > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.CONFLICT,
        message: `Gələcək ${upcoming} rezervasiya var — əvvəlcə onları həll edin`,
      });
    }
    await this.prisma.experience.update({ where: { id: exp.id }, data: { deletedAt: new Date(), status: 'archived' } });
    return { deleted: true };
  }

  /** Ekran 36 — expert öz təcrübələrini (qaralamalar daxil) görür. */
  async mine(userId: bigint, lang: Lang) {
    await this.assertExpert(userId);
    const rows = await this.prisma.experience.findMany({
      where: { expertId: userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        region: { include: { translations: { select: { lang: true, name: true } } } },
        photos: {
          where: { media: { deletedAt: null } },
          include: { media: { select: { storageKey: true } } },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
        _count: { select: { bookings: true, slots: true } },
      },
    });

    return rows.map((e) => {
      const rt = e.region.translations.find((x) => x.lang === lang) ?? e.region.translations.find((x) => x.lang === 'az');
      return {
        slug: e.slug,
        title: titleFor(e, lang),
        status: e.status,
        priceAzn: Number(e.priceAzn),
        pricing: this.priceBreakdown(Number(e.priceAzn), EXPERT_PAYOUT_RATE),
        rating: Number(e.ratingAvg),
        ratingCount: e.ratingCount,
        bookingCount: e._count.bookings,
        slotCount: e._count.slots,
        region: { slug: e.region.slug, name: rt?.name ?? e.region.slug },
        coverUrl: this.url(e.photos[0]?.media.storageKey),
      };
    });
  }

  async createSlots(userId: bigint, slug: string, dto: CreateSlotsDto) {
    const exp = await this.loadOwned(slug, userId);
    const capacity = dto.capacity ?? exp.maxGroup;

    let created = 0;
    let skipped = 0;
    for (const iso of dto.startAt) {
      const startAt = new Date(iso);
      if (startAt < new Date()) {
        skipped++;
        continue;
      }
      const existing = await this.prisma.experienceSlot.findUnique({
        where: { experienceId_startAt: { experienceId: exp.id, startAt } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await this.prisma.experienceSlot.create({ data: { experienceId: exp.id, startAt, capacity } });
      created++;
    }
    return { created, skipped, platformCommissionRate: PLATFORM_COMMISSION_RATE };
  }
}
