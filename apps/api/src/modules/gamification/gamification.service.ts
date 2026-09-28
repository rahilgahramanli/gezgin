import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ERROR_CODES, levelProgress, tierForLevel } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { distanceMeters } from '@/common/search/geo';
import { bakuDayStart } from '@/common/time';
import { currentLang, pickTr, tierName, trWhere } from '@/common/i18n';
import { XpService, type XpResult } from './xp.service';
import type { CheckinDto, LeaderboardDto } from './dto/gamification.dto';

/** Check-in üçün icazə verilən maksimum məsafə (metr). */
const DEFAULT_CHECKIN_RADIUS_M = 1000;

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly xp: XpService,
    private readonly config: ConfigService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private get checkinRadiusM(): number {
    return Number(this.config.get('CHECKIN_RADIUS_M') ?? DEFAULT_CHECKIN_RADIUS_M);
  }

  /**
   * Ekran 51 → 52: "Çatdım — check-in".
   *
   * Mövqe məcburidir və məkana yaxınlıq yoxlanılır. İlk dəfə gəlirsə XP verilir.
   * Eyni məkanda gündə (Bakı vaxtı ilə) yalnız bir check-in — təkrar 409-dur;
   * sonrakı günlərdə təkrar check-in qeydə alınır, amma XP vermir.
   */
  async checkin(userId: bigint, dto: CheckinDto) {
    const place = await this.prisma.place.findFirst({
      where: { slug: dto.place, deletedAt: null },
      include: {
        translations: { where: trWhere(), select: { lang: true, name: true } },
        region: { include: { translations: { where: trWhere(), select: { lang: true, name: true } } } },
      },
    });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.place}` });

    // Mövqesiz check-in yaxınlıq yoxlamasını keçirdi — istənilən yerdən XP toplamaq olurdu
    if (dto.lat === undefined || dto.lng === undefined) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Check-in üçün yerləşmə lazımdır — yerləşmə icazəsi verin',
      });
    }

    const rows = await this.prisma.$queryRaw<Array<{ d: number }>>`
      SELECT ${distanceMeters('geo', dto.lng, dto.lat)} AS d FROM places WHERE id = ${place.id}
    `;
    const distanceM = Math.round(Number(rows[0]?.d ?? 0));
    if (distanceM > this.checkinRadiusM) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Check-in üçün məkana ${this.checkinRadiusM} m-dən yaxın olmalısınız (hazırda ${(distanceM / 1000).toFixed(1)} km)`,
        details: { distanceM, maxDistanceM: this.checkinRadiusM },
      });
    }

    let trip: { id: bigint; publicId: string } | null = null;
    if (dto.trip) {
      const found = await this.prisma.trip.findFirst({
        where: { publicId: dto.trip, userId, deletedAt: null },
        select: { id: true, publicId: true },
      });
      if (!found) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Səyahət tapılmadı' });
      trip = found;
    }

    // SIRA VACİBDİR: check-in sətri əvvəlcə yazılır, sonra XP verilir.
    // `award()` Gezgin Score-u və badge tərəqqisini bazadan yenidən hesablayır —
    // əks halda bu check-in hesaba daxil olmaz və nəticə bir addım geri qalar.
    //
    // Yoxlama + yazma istifadəçi sətri kilidlənmiş tranzaksiyadadır ki, eyni anda
    // gələn iki sorğu "bu gün hələ yoxdur" görüb ikisi də yazmasın.
    const lat = dto.lat;
    const lng = dto.lng;
    const { checkin, isFirst, firstInRegion } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

      const today = await tx.checkin.findFirst({
        where: { userId, placeId: place.id, createdAt: { gte: bakuDayStart() } },
        select: { id: true },
      });
      if (today) {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'Bu məkanda bu gün artıq check-in etmisən',
        });
      }

      const previous = await tx.checkin.findFirst({ where: { userId, placeId: place.id }, select: { id: true } });
      // İlk regional ziyarətdirsə ekran 32-dəki region tərəqqisi artır
      const inRegion = await tx.checkin.findFirst({ where: { userId, regionId: place.regionId }, select: { id: true } });

      const created = await tx.checkin.create({
        data: {
          userId,
          placeId: place.id,
          regionId: place.regionId,
          tripId: trip?.id ?? null,
          lat: new Prisma.Decimal(lat),
          lng: new Prisma.Decimal(lng),
          xpAwarded: 0,
          isFirst: !previous,
        },
      });
      await tx.place.update({ where: { id: place.id }, data: { checkinCount: { increment: 1 } } });
      return { checkin: created, isFirst: !previous, firstInRegion: !inRegion };
    });

    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, gezginScore: true, level: true },
    });

    const result: XpResult = isFirst
      ? await this.xp.award(userId, 'place_checkin', { type: 'place', id: place.id, note: pickTr(place.translations, 'az')?.name })
      : {
          action: 'place_checkin',
          xpGained: 0,
          xpTotal: current.xp,
          scoreDelta: 0,
          scoreTotal: current.gezginScore,
          levelBefore: current.level,
          levelAfter: current.level,
          leveledUp: false,
          tier: tierName(tierForLevel(current.level)),
          xpToNext: levelProgress(current.xp).xpToNext,
          percent: levelProgress(current.xp).percent,
          cappedByDailyLimit: false,
          newBadges: [],
        };

    if (result.xpGained > 0) {
      await this.prisma.checkin.update({ where: { id: checkin.id }, data: { xpAwarded: result.xpGained } });
    }

    // Plandakı uyğun element avtomatik tamamlanır — ekran 51
    let completedItems = 0;
    if (trip) {
      const updated = await this.prisma.tripItem.updateMany({
        where: { tripId: trip.id, placeId: place.id, isDone: false },
        data: { isDone: true, doneAt: new Date() },
      });
      completedItems = updated.count;
    }

    const progress = trip
      ? await this.prisma.tripItem.groupBy({ by: ['isDone'], where: { tripId: trip.id }, _count: true })
      : [];
    const doneCount = progress.find((p) => p.isDone)?._count ?? 0;
    const totalCount = progress.reduce((n, p) => n + p._count, 0);

    return {
      place: {
        slug: place.slug,
        name: pickTr(place.translations)?.name ?? place.slug,
        region: { slug: place.region.slug, name: pickTr(place.region.translations)?.name ?? place.region.slug },
      },
      isFirstVisit: isFirst,
      isFirstInRegion: firstInRegion,
      distanceM,
      checkedInAt: new Date(),
      rewards: {
        xpGained: result.xpGained,
        scoreDelta: result.scoreDelta,
        xpTotal: result.xpTotal,
        gezginScore: result.scoreTotal,
        levelBefore: result.levelBefore,
        levelAfter: result.levelAfter,
        leveledUp: result.leveledUp,
        tier: result.tier,
        xpToNext: result.xpToNext,
        percent: result.percent,
        cappedByDailyLimit: result.cappedByDailyLimit,
        newBadges: result.newBadges,
      },
      trip: trip
        ? { publicId: trip.publicId, completedItems, done: doneCount, total: totalCount,
            percent: totalCount ? Math.round((doneCount / totalCount) * 100) : 0 }
        : null,
    };
  }

  async myCheckins(userId: bigint, offset = 0, limit = 30) {
    const rows = await this.prisma.checkin.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
      include: {
        place: {
          include: {
            translations: { where: trWhere(), select: { lang: true, name: true } },
            photos: {
              where: { media: { deletedAt: null } },
              include: { media: { select: { storageKey: true } } },
              orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
            },
          },
        },
        region: { include: { translations: { where: trWhere(), select: { lang: true, name: true } } } },
      },
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((c) => ({
        place: {
          slug: c.place.slug,
          name: pickTr(c.place.translations)?.name ?? c.place.slug,
          imageUrl: this.url(c.place.photos[0]?.media.storageKey),
        },
        region: { slug: c.region.slug, name: pickTr(c.region.translations)?.name ?? c.region.slug },
        isFirst: c.isFirst,
        xpAwarded: c.xpAwarded,
        createdAt: c.createdAt,
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Region slug → cari dildəki ad (az üçün sorğu getmir). */
  private async regionNames(slugs: Array<string | null>): Promise<Map<string, string>> {
    const lang = currentLang();
    const unique = [...new Set(slugs.filter((s): s is string => Boolean(s)))];
    if (lang === 'az' || !unique.length) return new Map();
    const rows = await this.prisma.regionTranslation.findMany({
      where: { lang, region: { slug: { in: unique } } },
      select: { name: true, region: { select: { slug: true } } },
    });
    return new Map(rows.map((r) => [r.region.slug, r.name]));
  }

  /**
   * Ekran 31 — liderlər cədvəli.
   *
   * `all_time` Gezgin Score-a görə, dövri siyahılar isə həmin dövrdə
   * qazanılan XP-yə görə hesablanır. Snapshot cədvəli sıra dəyişikliyini
   * (↑3) göstərmək üçün istifadə olunur — Sprint 9-da cron ilə doldurulacaq.
   */
  async leaderboard(dto: LeaderboardDto, viewerId?: bigint) {
    const period = dto.period ?? 'weekly';
    const limit = dto.limit ?? 20;

    const since =
      period === 'weekly'
        ? new Date(Date.now() - 7 * 86400_000)
        : period === 'monthly'
          ? new Date(Date.now() - 30 * 86400_000)
          : null;

    const filters: Prisma.Sql[] = [Prisma.sql`u.deleted_at IS NULL`, Prisma.sql`u.status = 'active'`];
    if (dto.region) filters.push(Prisma.sql`r.slug = ${dto.region}`);
    if (dto.following === 'true' && viewerId) {
      filters.push(Prisma.sql`(u.id = ${viewerId} OR EXISTS (
        SELECT 1 FROM follows f WHERE f.follower_id = ${viewerId} AND f.following_id = u.id
      ))`);
    }
    const where = Prisma.join(filters, ' AND ');

    const rows = since
      ? await this.prisma.$queryRaw<Array<{ id: bigint; username: string; full_name: string; level: number; role: string; avatar_key: string | null; region_name: string | null; region_slug: string | null; points: bigint }>>`
          SELECT u.id, u.username, u.full_name, u.level, u.role,
                 m.storage_key AS avatar_key, rt.name AS region_name, r.slug AS region_slug,
                 COALESCE(SUM(x.xp), 0) AS points
          FROM users u
          LEFT JOIN media_assets m ON m.id = u.avatar_id
          LEFT JOIN regions r ON r.id = u.home_region_id
          LEFT JOIN region_translations rt ON rt.region_id = r.id AND rt.lang = 'az'
          LEFT JOIN xp_transactions x ON x.user_id = u.id AND x.created_at >= ${since}
          WHERE ${where}
          GROUP BY u.id
          HAVING points > 0
          ORDER BY points DESC, u.gezgin_score DESC
          LIMIT ${limit}
        `
      : await this.prisma.$queryRaw<Array<{ id: bigint; username: string; full_name: string; level: number; role: string; avatar_key: string | null; region_name: string | null; region_slug: string | null; points: bigint }>>`
          SELECT u.id, u.username, u.full_name, u.level, u.role,
                 m.storage_key AS avatar_key, rt.name AS region_name, r.slug AS region_slug,
                 u.gezgin_score AS points
          FROM users u
          LEFT JOIN media_assets m ON m.id = u.avatar_id
          LEFT JOIN regions r ON r.id = u.home_region_id
          LEFT JOIN region_translations rt ON rt.region_id = r.id AND rt.lang = 'az'
          WHERE ${where}
          ORDER BY points DESC
          LIMIT ${limit}
        `;

    // SQL az adı qaytarır (GROUP BY-a görə tərcümə JOIN-u burada qoşulmur) — digər dil sonradan
    const regionNames = await this.regionNames(rows.map((r) => r.region_slug));
    const entries = rows.map((r, i) => ({
      rank: i + 1,
      username: r.username,
      fullName: r.full_name,
      level: r.level,
      isLocalExpert: r.role === 'local_expert',
      region: (r.region_slug && regionNames.get(r.region_slug)) ?? r.region_name,
      avatarUrl: this.url(r.avatar_key),
      points: Number(r.points),
      isMe: viewerId !== undefined && r.id === viewerId,
    }));

    // İstifadəçi ilk N-də deyilsə, öz sırasını ayrıca hesablayırıq — ekran 31
    let me = entries.find((e) => e.isMe) ?? null;
    if (!me && viewerId) {
      const user = await this.prisma.user.findUnique({
        where: { id: viewerId },
        select: { username: true, fullName: true, level: true, role: true, gezginScore: true, avatar: { select: { storageKey: true } } },
      });
      if (user) {
        const myPoints = since
          ? Number(
              (await this.prisma.xpTransaction.aggregate({
                where: { userId: viewerId, createdAt: { gte: since } },
                _sum: { xp: true },
              }))._sum.xp ?? 0,
            )
          : user.gezginScore;

        // Sıra siyahı ilə eyni filtrlərlə (region, "Dostlarım") sayılır — əks halda
        // "Dostlarım"da 3 nəfər arasında 1500-cü yer kimi mənasız rəqəm çıxır
        const ahead = since
          ? await this.prisma.$queryRaw<Array<{ n: bigint }>>`
              SELECT COUNT(*) AS n FROM (
                SELECT u.id, COALESCE(SUM(x.xp), 0) AS pts
                FROM users u
                LEFT JOIN regions r ON r.id = u.home_region_id
                LEFT JOIN xp_transactions x ON x.user_id = u.id AND x.created_at >= ${since}
                WHERE ${where}
                GROUP BY u.id HAVING pts > ${myPoints}
              ) t
            `
          : await this.prisma.$queryRaw<Array<{ n: bigint }>>`
              SELECT COUNT(*) AS n FROM users u
              LEFT JOIN regions r ON r.id = u.home_region_id
              WHERE ${where} AND u.gezgin_score > ${myPoints}
            `;

        me = {
          rank: Number(ahead[0]?.n ?? 0) + 1,
          username: user.username,
          fullName: user.fullName,
          level: user.level,
          isLocalExpert: user.role === 'local_expert',
          region: null,
          avatarUrl: this.url(user.avatar?.storageKey),
          points: myPoints,
          isMe: true,
        };
      }
    }

    // Ekran 31-dəki "↑3" göstəricisi — əvvəlki snapshot varsa
    let rankChange: number | null = null;
    if (me && viewerId) {
      const snapshot = await this.prisma.leaderboardSnapshot.findFirst({
        where: { userId: viewerId, period: period === 'all_time' ? 'all_time' : period, scope: dto.region ?? 'global' },
        orderBy: { createdAt: 'desc' },
      });
      if (snapshot) rankChange = snapshot.rank - me.rank;
    }

    return {
      period,
      scope: dto.region ?? 'global',
      podium: entries.slice(0, 3),
      entries,
      me: me ? { ...me, rankChange } : null,
    };
  }
}
