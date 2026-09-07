import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ERROR_CODES, levelProgress, tierForLevel } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { distanceMeters } from '@/common/search/geo';
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
   * Mövqe göndərilirsə məkana yaxınlıq yoxlanılır. İlk dəfə gəlirsə XP verilir,
   * təkrar check-in qeydə alınır, amma XP vermir.
   */
  async checkin(userId: bigint, dto: CheckinDto) {
    const place = await this.prisma.place.findFirst({
      where: { slug: dto.place, deletedAt: null },
      include: {
        translations: { where: { lang: 'az' }, select: { name: true } },
        region: { include: { translations: { where: { lang: 'az' }, select: { name: true } } } },
      },
    });
    if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.place}` });

    let distanceM: number | null = null;
    if (dto.lat !== undefined && dto.lng !== undefined) {
      const rows = await this.prisma.$queryRaw<Array<{ d: number }>>`
        SELECT ${distanceMeters('geo', dto.lng, dto.lat)} AS d FROM places WHERE id = ${place.id}
      `;
      distanceM = Math.round(Number(rows[0]?.d ?? 0));
      if (distanceM > this.checkinRadiusM) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: `Check-in üçün məkana ${this.checkinRadiusM} m-dən yaxın olmalısınız (hazırda ${(distanceM / 1000).toFixed(1)} km)`,
          details: { distanceM, maxDistanceM: this.checkinRadiusM },
        });
      }
    }

    const previous = await this.prisma.checkin.findFirst({ where: { userId, placeId: place.id } });
    const isFirst = !previous;

    // İlk regional ziyarətdirsə ekran 32-dəki region tərəqqisi artır
    const firstInRegion = !(await this.prisma.checkin.findFirst({ where: { userId, regionId: place.regionId } }));

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
    const checkin = await this.prisma.checkin.create({
      data: {
        userId,
        placeId: place.id,
        regionId: place.regionId,
        tripId: trip?.id ?? null,
        lat: dto.lat === undefined ? null : new Prisma.Decimal(dto.lat),
        lng: dto.lng === undefined ? null : new Prisma.Decimal(dto.lng),
        xpAwarded: 0,
        isFirst,
      },
    });

    await this.prisma.place.update({ where: { id: place.id }, data: { checkinCount: { increment: 1 } } });

    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, gezginScore: true, level: true },
    });

    const result: XpResult = isFirst
      ? await this.xp.award(userId, 'place_checkin', { type: 'place', id: place.id, note: place.translations[0]?.name })
      : {
          action: 'place_checkin',
          xpGained: 0,
          xpTotal: current.xp,
          scoreDelta: 0,
          scoreTotal: current.gezginScore,
          levelBefore: current.level,
          levelAfter: current.level,
          leveledUp: false,
          tier: tierForLevel(current.level).nameAz,
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
        name: place.translations[0]?.name ?? place.slug,
        region: { slug: place.region.slug, name: place.region.translations[0]?.name ?? place.region.slug },
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
            translations: { where: { lang: 'az' }, select: { name: true } },
            photos: {
              where: { media: { deletedAt: null } },
              include: { media: { select: { storageKey: true } } },
              orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
            },
          },
        },
        region: { include: { translations: { where: { lang: 'az' }, select: { name: true } } } },
      },
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((c) => ({
        place: {
          slug: c.place.slug,
          name: c.place.translations[0]?.name ?? c.place.slug,
          imageUrl: this.url(c.place.photos[0]?.media.storageKey),
        },
        region: { slug: c.region.slug, name: c.region.translations[0]?.name ?? c.region.slug },
        isFirst: c.isFirst,
        xpAwarded: c.xpAwarded,
        createdAt: c.createdAt,
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
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
      ? await this.prisma.$queryRaw<Array<{ id: bigint; username: string; full_name: string; level: number; role: string; avatar_key: string | null; region_name: string | null; points: bigint }>>`
          SELECT u.id, u.username, u.full_name, u.level, u.role,
                 m.storage_key AS avatar_key, rt.name AS region_name,
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
      : await this.prisma.$queryRaw<Array<{ id: bigint; username: string; full_name: string; level: number; role: string; avatar_key: string | null; region_name: string | null; points: bigint }>>`
          SELECT u.id, u.username, u.full_name, u.level, u.role,
                 m.storage_key AS avatar_key, rt.name AS region_name,
                 u.gezgin_score AS points
          FROM users u
          LEFT JOIN media_assets m ON m.id = u.avatar_id
          LEFT JOIN regions r ON r.id = u.home_region_id
          LEFT JOIN region_translations rt ON rt.region_id = r.id AND rt.lang = 'az'
          WHERE ${where}
          ORDER BY points DESC
          LIMIT ${limit}
        `;

    const entries = rows.map((r, i) => ({
      rank: i + 1,
      username: r.username,
      fullName: r.full_name,
      level: r.level,
      isLocalExpert: r.role === 'local_expert',
      region: r.region_name,
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

        const ahead = since
          ? await this.prisma.$queryRaw<Array<{ n: bigint }>>`
              SELECT COUNT(*) AS n FROM (
                SELECT u.id, COALESCE(SUM(x.xp), 0) AS pts
                FROM users u
                LEFT JOIN xp_transactions x ON x.user_id = u.id AND x.created_at >= ${since}
                WHERE u.deleted_at IS NULL AND u.status = 'active'
                GROUP BY u.id HAVING pts > ${myPoints}
              ) t
            `
          : await this.prisma.$queryRaw<Array<{ n: bigint }>>`
              SELECT COUNT(*) AS n FROM users
              WHERE deleted_at IS NULL AND status = 'active' AND gezgin_score > ${myPoints}
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
