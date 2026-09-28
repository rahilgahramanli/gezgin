import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, gezginScore, levelProgress } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { XpService } from '@/modules/gamification/xp.service';
import { CATEGORY_NAME_SELECT, categoryName, pickTr, tierName, trWhere } from '@/common/i18n';
import type { BlockUserDto, SetInterestsDto, UpdateMeDto, UpdateSettingsDto } from './dto/me.dto';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly xp: XpService,
  ) {}

  private mediaUrl(key: string | undefined | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  async profile(userId: bigint) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        avatar: { select: { storageKey: true, blurhash: true } },
        cover: { select: { storageKey: true, blurhash: true } },
        homeRegion: { select: { slug: true, translations: { where: trWhere(), select: { lang: true, name: true } } } },
        interests: { include: { category: { select: { slug: true, ...CATEGORY_NAME_SELECT, icon: true } } } },
        expertProfile: { select: { ratingAvg: true, ratingCount: true, experienceCount: true, specialties: true } },
      },
    });

    const progress = levelProgress(user.xp);

    return {
      publicId: user.publicId,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      bio: user.bio,
      gender: user.gender,
      birthDate: user.birthDate,
      role: user.role,
      isPublic: user.isPublic,
      isVerified: user.isVerified,
      emailVerified: user.emailVerifiedAt !== null,
      avatarUrl: this.mediaUrl(user.avatar?.storageKey),
      coverUrl: this.mediaUrl(user.cover?.storageKey),
      homeRegion: user.homeRegion
        ? { slug: user.homeRegion.slug, name: pickTr(user.homeRegion.translations)?.name ?? user.homeRegion.slug }
        : null,
      interests: user.interests.map((i) => ({
        slug: i.category.slug,
        name: categoryName(i.category),
        icon: i.category.icon,
      })),
      gamification: {
        level: progress.level,
        tier: tierName(progress.tier),
        xp: user.xp,
        xpInLevel: progress.xpInLevel,
        xpForLevel: progress.xpForLevel,
        xpToNext: progress.xpToNext,
        percent: progress.percent,
        gezginScore: user.gezginScore,
      },
      expert: user.expertProfile,
      onboardingCompleted: user.interests.length > 0,
      createdAt: user.createdAt,
    };
  }

  async update(userId: bigint, dto: UpdateMeDto) {
    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: dto.username, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException({ code: ERROR_CODES.USERNAME_TAKEN, message: 'Bu istifadəçi adı tutulub' });
    }

    let homeRegionId: bigint | null | undefined;
    if (dto.homeRegionSlug === null || dto.homeRegionSlug === '') {
      // Ev regionunu götürmək — ekran 54
      homeRegionId = null;
    } else if (dto.homeRegionSlug !== undefined) {
      const region = await this.prisma.region.findUnique({ where: { slug: dto.homeRegionSlug }, select: { id: true } });
      if (!region) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Region tapılmadı: ${dto.homeRegionSlug}` });
      homeRegionId = region.id;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.username !== undefined ? { username: dto.username } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(homeRegionId !== undefined ? { homeRegionId } : {}),
      },
    });

    // `isPublic` və ayarlardakı `profileVisibility` eyni şeyi deyir — uyğun saxlanılır
    if (dto.isPublic !== undefined) {
      const current = await this.settings(userId);
      const profileVisibility = dto.isPublic
        ? 'public'
        : current.profileVisibility === 'public' ? 'followers' : current.profileVisibility;
      if (profileVisibility !== current.profileVisibility) {
        await this.prisma.userSettings.update({ where: { userId }, data: { profileVisibility } });
      }
    }
    return this.profile(userId);
  }

  /** Avatar və cover — media əvvəlcə /media/presign + /complete ilə yüklənir. */
  async setProfileMedia(userId: bigint, field: 'avatar' | 'cover', mediaPublicId: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: mediaPublicId } });
    if (!media || media.status !== 'ready') {
      throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Media tapılmadı və ya yüklənməyib' });
    }
    if (media.ownerId !== userId) {
      throw new BadRequestException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu media sizə aid deyil' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: field === 'avatar' ? { avatarId: media.id } : { coverId: media.id },
    });
    return this.profile(userId);
  }

  // ─────────────────── maraqlar ───────────────────

  async interests(userId: bigint) {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { category: { select: { slug: true, ...CATEGORY_NAME_SELECT, icon: true } } },
    });
    return rows.map((r) => ({ slug: r.category.slug, name: categoryName(r.category), icon: r.category.icon }));
  }

  /** Ekran 04 — maraqları tam əvəz edir. */
  async setInterests(userId: bigint, dto: SetInterestsDto) {
    const categories = await this.prisma.category.findMany({
      where: { slug: { in: dto.slugs }, isActive: true },
      select: { id: true, slug: true },
    });
    const missing = dto.slugs.filter((s) => !categories.some((c) => c.slug === s));
    if (missing.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Kateqoriya tapılmadı: ${missing.join(', ')}`,
      });
    }

    const isFirstTime = (await this.prisma.userInterest.count({ where: { userId } })) === 0;

    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userInterest.createMany({
        data: categories.map((c) => ({ userId, categoryId: c.id })),
      }),
    ]);

    // Ekran 39: "Profilini tamamla → +100 XP"
    if (isFirstTime) await this.xp.award(userId, 'profile_completed', { type: 'user', id: userId });

    return this.interests(userId);
  }

  // ─────────────────── ayarlar ───────────────────

  async settings(userId: bigint) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateSettings(userId: bigint, dto: UpdateSettingsDto) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    // Görünürlük faktiki olaraq `users.isPublic` ilə tətbiq olunur (lent, hekayə, profil):
    // "İzləyicilər" və "Yalnız mən" qapalı hesab deməkdir
    if (dto.profileVisibility !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isPublic: dto.profileVisibility === 'public' },
      });
    }
    return settings;
  }

  // ─────────────────── statistika ───────────────────

  /** Ekran 28 profil statistikası: Regions · Places · Experiences · Routes · Want to go */
  async stats(userId: bigint) {
    const [regions, places, experiences, routes, wantToGo, reviews, posts, followers, following, badges] =
      await Promise.all([
        this.prisma.checkin.findMany({ where: { userId }, select: { regionId: true }, distinct: ['regionId'] }),
        this.prisma.checkin.findMany({ where: { userId }, select: { placeId: true }, distinct: ['placeId'] }),
        this.prisma.booking.count({ where: { userId, status: 'completed', type: 'experience' } }),
        this.prisma.route.count({ where: { authorId: userId, deletedAt: null } }),
        this.prisma.savedItem.count({ where: { userId } }),
        this.prisma.review.count({ where: { userId, deletedAt: null } }),
        this.prisma.post.count({ where: { userId, deletedAt: null } }),
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.follow.count({ where: { followerId: userId } }),
        this.prisma.userBadge.count({ where: { userId, earnedAt: { not: null } } }),
      ]);

    const totalRegions = await this.prisma.region.count({ where: { parentId: { not: null } } });
    const counts = {
      regions: regions.length,
      places: places.length,
      experiences,
      routes,
      wantToGo,
      reviews,
      posts,
      followers,
      following,
      badges,
    };

    return {
      ...counts,
      regionsTotal: totalRegions,
      score: gezginScore({
        regions: counts.regions,
        places: counts.places,
        experiences: counts.experiences,
        routes: counts.routes,
        reviews: counts.reviews,
        posts: counts.posts,
        followers: counts.followers,
      }),
    };
  }

  /** Ekran 32 — kəşf edilmiş regionlar və tərəqqi. */
  async regionProgress(userId: bigint) {
    const regions = await this.prisma.region.findMany({
      where: { parentId: { not: null } },
      select: {
        slug: true,
        placeCount: true,
        translations: { where: trWhere(), select: { lang: true, name: true } },
        cover: { select: { storageKey: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const visited = await this.prisma.checkin.groupBy({
      by: ['regionId'],
      where: { userId },
      _count: { placeId: true },
      _max: { createdAt: true },
    });

    const byRegion = await this.prisma.region.findMany({
      where: { id: { in: visited.map((v) => v.regionId) } },
      select: { id: true, slug: true },
    });
    const slugById = new Map(byRegion.map((r) => [r.id.toString(), r.slug]));
    const visitedBySlug = new Map(
      visited.map((v) => [slugById.get(v.regionId.toString()) ?? '', { places: v._count.placeId, lastVisit: v._max.createdAt }]),
    );

    const items = regions.map((r) => {
      const v = visitedBySlug.get(r.slug);
      return {
        slug: r.slug,
        name: pickTr(r.translations)?.name ?? r.slug,
        coverUrl: this.mediaUrl(r.cover?.storageKey),
        placeCount: r.placeCount,
        visitedPlaces: v?.places ?? 0,
        lastVisit: v?.lastVisit ?? null,
        percent: r.placeCount > 0 ? Math.min(100, Math.round(((v?.places ?? 0) / r.placeCount) * 100)) : 0,
        discovered: (v?.places ?? 0) > 0,
      };
    });

    const discovered = items.filter((i) => i.discovered).length;
    return {
      discovered,
      total: items.length,
      percent: items.length ? Math.round((discovered / items.length) * 100) : 0,
      regions: items,
    };
  }

  // ─────────────────── bloklama ───────────────────

  async blocked(userId: bigint) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { publicId: true, username: true, fullName: true, avatar: { select: { storageKey: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      publicId: r.blocked.publicId,
      username: r.blocked.username,
      fullName: r.blocked.fullName,
      avatarUrl: this.mediaUrl(r.blocked.avatar?.storageKey),
      blockedAt: r.createdAt,
    }));
  }

  async block(userId: bigint, username: string, dto: BlockUserDto) {
    const target = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });
    if (target.id === userId) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Özünüzü bloklaya bilməzsiniz' });
    }

    await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: target.id } },
        update: { reason: dto.reason ?? null },
        create: { blockerId: userId, blockedId: target.id, reason: dto.reason ?? null },
      }),
      // Bloklama izləmə əlaqəsini hər iki istiqamətdə kəsir
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followingId: target.id },
            { followerId: target.id, followingId: userId },
          ],
        },
      }),
    ]);
    return { blocked: true };
  }

  async unblock(userId: bigint, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });
    await this.prisma.block.deleteMany({ where: { blockerId: userId, blockedId: target.id } });
    return { blocked: false };
  }

  // ─────────────────── hesabın silinməsi ───────────────────

  /** GDPR-uyğun: şəxsi məlumatlar anonimləşdirilir, kontent qalır. */
  async deleteAccount(userId: bigint) {
    const stamp = Date.now().toString(36);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'deleted',
          deletedAt: new Date(),
          email: null,
          phone: null,
          passwordHash: null,
          fullName: 'Silinmiş istifadəçi',
          username: `silinmis_${stamp}`,
          bio: null,
          avatarId: null,
          coverId: null,
          isPublic: false,
        },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.device.deleteMany({ where: { userId } }),
    ]);
    return { deleted: true };
  }
}
