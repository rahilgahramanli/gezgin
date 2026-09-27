import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type BadgeCondition, type XpAction } from '@prisma/client';
import {
  XP_RULES, gezginScore, levelForXp, levelProgress, tierForLevel, type ScoreInput,
} from '@gezgin/shared';
import { bakuDayStart } from '@/common/time';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotificationsService } from '@/modules/community/notifications.service';

export interface EarnedBadge {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  tier: string | null;
}

export interface XpResult {
  action: XpAction;
  xpGained: number;
  xpTotal: number;
  scoreDelta: number;
  scoreTotal: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  tier: string;
  xpToNext: number;
  percent: number;
  cappedByDailyLimit: boolean;
  newBadges: EarnedBadge[];
}

/**
 * XP, level, Gezgin Score və badge məntiqi — tək giriş nöqtəsi.
 *
 * Bütün qazanma axınları (check-in, rəy, paylaşım, marşrut, səyahət)
 * `award()` çağırır. Qaydalar `@gezgin/shared/gamification`-dədir ki,
 * mobil tərəf də eyni hesablamanı göstərə bilsin.
 */
@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Sui-istifadəyə qarşı: bəzi hərəkətlərin gündəlik limiti var. */
  private async isDailyCapReached(userId: bigint, action: XpAction): Promise<boolean> {
    const rule = XP_RULES[action as keyof typeof XP_RULES];
    if (!rule?.dailyCap) return false;

    // Limit Bakı təqvim gününə görə sıfırlanır — check-in qaydası ilə eyni gün sərhədi
    const since = bakuDayStart();
    // Yalnız XP gətirən sətirlər sayılır — geri alma (mənfi) sətirləri limiti doldurmamalıdır
    const used = await this.prisma.xpTransaction.count({
      where: { userId, action, createdAt: { gte: since }, xp: { gt: 0 } },
    });
    return used >= rule.dailyCap;
  }

  /** Gezgin Score istifadəçinin bütün fəaliyyətindən yenidən hesablanır. */
  private async recomputeScore(userId: bigint): Promise<number> {
    const [regions, places, experiences, routes, reviews, posts, followers] = await Promise.all([
      this.prisma.checkin.findMany({ where: { userId }, select: { regionId: true }, distinct: ['regionId'] }),
      this.prisma.checkin.findMany({ where: { userId }, select: { placeId: true }, distinct: ['placeId'] }),
      this.prisma.booking.count({ where: { userId, status: 'completed', type: 'experience' } }),
      this.prisma.route.count({ where: { authorId: userId, deletedAt: null } }),
      this.prisma.review.count({ where: { userId, deletedAt: null } }),
      this.prisma.post.count({ where: { userId, deletedAt: null } }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    const input: ScoreInput = {
      regions: regions.length,
      places: places.length,
      experiences,
      routes,
      reviews,
      posts,
      followers,
    };
    return gezginScore(input);
  }

  /** Badge şərtlərinin cari dəyərləri. */
  private async progressValues(userId: bigint, level: number): Promise<Record<BadgeCondition, number>> {
    const [places, regions, posts, routes, experiences, reviews, checkins] = await Promise.all([
      this.prisma.checkin.findMany({ where: { userId }, select: { placeId: true }, distinct: ['placeId'] }),
      this.prisma.checkin.findMany({ where: { userId }, select: { regionId: true }, distinct: ['regionId'] }),
      // "Fotoqu" badge-i foto/video paylaşımlarını sayır — mətn yazıları yox
      this.prisma.post.count({ where: { userId, deletedAt: null, media: { some: {} } } }),
      this.prisma.route.count({ where: { authorId: userId, deletedAt: null } }),
      this.prisma.booking.count({ where: { userId, status: 'completed', type: 'experience' } }),
      this.prisma.review.count({ where: { userId, deletedAt: null } }),
      this.prisma.checkin.count({ where: { userId } }),
    ]);

    return {
      places_visited: places.length,
      regions_visited: regions.length,
      posts_created: posts,
      routes_created: routes,
      experiences_done: experiences,
      reviews_written: reviews,
      level_reached: level,
      checkins,
    };
  }

  /** Bütün badge-lərin tərəqqisini yeniləyir, yeni qazanılanları qaytarır. */
  async syncBadges(userId: bigint, level: number): Promise<EarnedBadge[]> {
    const [badges, owned, values] = await Promise.all([
      this.prisma.badge.findMany({ where: { isActive: true } }),
      this.prisma.userBadge.findMany({ where: { userId } }),
      this.progressValues(userId, level),
    ]);

    const ownedByBadge = new Map(owned.map((o) => [o.badgeId.toString(), o]));
    const earned: EarnedBadge[] = [];

    for (const badge of badges) {
      const current = values[badge.conditionType] ?? 0;
      const existing = ownedByBadge.get(badge.id.toString());
      const alreadyEarned = existing?.earnedAt != null;
      const reached = current >= badge.conditionValue;

      if (alreadyEarned) {
        if (existing.progress !== current) {
          await this.prisma.userBadge.update({
            where: { userId_badgeId: { userId, badgeId: badge.id } },
            data: { progress: current },
          });
        }
        continue;
      }

      await this.prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: { progress: current, ...(reached ? { earnedAt: new Date() } : {}) },
        create: { userId, badgeId: badge.id, progress: current, earnedAt: reached ? new Date() : null },
      });

      if (reached) {
        earned.push({
          slug: badge.slug,
          name: badge.nameAz,
          description: badge.descriptionAz,
          icon: badge.icon,
          tier: badge.tier,
        });
      }
    }

    return earned;
  }

  /**
   * XP verir, level dəyişikliyini və yeni badge-ləri hesablayır.
   * `xp_transactions` audit izidir — geri hesablamaq üçün.
   */
  async award(
    userId: bigint,
    action: XpAction,
    target?: { type: string; id: bigint; note?: string },
  ): Promise<XpResult> {
    const rule = XP_RULES[action as keyof typeof XP_RULES];
    const capped = await this.isDailyCapReached(userId, action);
    const xpGained = capped ? 0 : (rule?.xp ?? 0);

    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, level: true, gezginScore: true },
    });

    const xpTotal = before.xp + xpGained;
    const levelAfter = levelForXp(xpTotal);
    const scoreTotal = await this.recomputeScore(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: xpTotal, level: levelAfter, gezginScore: scoreTotal },
    });

    await this.prisma.xpTransaction.create({
      data: {
        userId,
        action,
        xp: xpGained,
        scoreDelta: scoreTotal - before.gezginScore,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        levelAfter,
        note: capped ? 'Gündəlik limit dolub' : (target?.note ?? null),
      },
    });

    const newBadges = await this.syncBadges(userId, levelAfter);
    const progress = levelProgress(xpTotal);

    if (levelAfter > before.level) {
      this.logger.log(`İstifadəçi ${userId} → Level ${levelAfter} (${progress.tier.nameAz})`);
      await this.notifications.notify({
        userId,
        type: 'level_up',
        title: `Yeni səviyyə: Level ${levelAfter} · ${progress.tier.nameAz}`,
        body: `+${xpGained} XP`,
        targetType: 'level',
        deepLink: 'gezgin://score',
      });
    }
    for (const badge of newBadges) {
      await this.notifications.notify({
        userId,
        type: 'badge_earned',
        title: `Yeni badge: ${badge.name} 🎉`,
        body: badge.description,
        targetType: 'badge',
        deepLink: 'gezgin://badges',
      });
    }

    return {
      action,
      xpGained,
      xpTotal,
      scoreDelta: scoreTotal - before.gezginScore,
      scoreTotal,
      levelBefore: before.level,
      levelAfter,
      leveledUp: levelAfter > before.level,
      tier: progress.tier.nameAz,
      xpToNext: progress.xpToNext,
      percent: progress.percent,
      cappedByDailyLimit: capped,
      newBadges,
    };
  }

  /**
   * Verilmiş XP-ni geri alır (məs. təsdiqlənmiş rezervasiya ləğv olunanda).
   *
   * Həmin hədəf üçün yazılmış bütün sətirlərin cəmi qədər mənfi sətir yazılır —
   * təkrar çağırış ikinci dəfə çıxmır. XP 0-dan aşağı düşmür; level və
   * Gezgin Score yenidən hesablanır. Qazanılmış badge-lər geri alınmır.
   */
  async revoke(
    userId: bigint,
    action: XpAction,
    target: { type: string; id: bigint; note?: string },
  ): Promise<{ xpRevoked: number; xpTotal: number; levelAfter: number }> {
    const granted = await this.prisma.xpTransaction.aggregate({
      where: { userId, action, targetType: target.type, targetId: target.id },
      _sum: { xp: true },
    });
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, level: true, gezginScore: true },
    });

    const owed = granted._sum.xp ?? 0;
    if (owed <= 0) return { xpRevoked: 0, xpTotal: before.xp, levelAfter: before.level };

    const xpRevoked = Math.min(owed, before.xp);
    const xpTotal = before.xp - xpRevoked;
    const levelAfter = levelForXp(xpTotal);
    const scoreTotal = await this.recomputeScore(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: xpTotal, level: levelAfter, gezginScore: scoreTotal },
    });
    await this.prisma.xpTransaction.create({
      data: {
        userId,
        action,
        xp: -owed,
        scoreDelta: scoreTotal - before.gezginScore,
        targetType: target.type,
        targetId: target.id,
        levelAfter,
        note: (target.note ?? 'XP geri alındı').slice(0, 190),
      },
    });
    await this.syncBadges(userId, levelAfter);

    return { xpRevoked, xpTotal, levelAfter };
  }

  /** Ekran 29 — Gezgin Score kartı. */
  async score(userId: bigint) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, level: true, gezginScore: true },
    });
    const progress = levelProgress(user.xp);

    const monthAgo = new Date(Date.now() - 30 * 86400_000);
    const [monthXp, monthScore, thisMonth] = await Promise.all([
      this.prisma.xpTransaction.aggregate({
        where: { userId, createdAt: { gte: monthAgo } },
        _sum: { xp: true },
      }),
      this.prisma.xpTransaction.aggregate({
        where: { userId, createdAt: { gte: monthAgo } },
        _sum: { scoreDelta: true },
      }),
      this.prisma.xpTransaction.groupBy({
        by: ['action'],
        where: { userId, createdAt: { gte: monthAgo } },
        _count: true,
        _sum: { xp: true },
      }),
    ]);

    const gainedScore = monthScore._sum.scoreDelta ?? 0;
    const previousScore = user.gezginScore - gainedScore;

    return {
      gezginScore: user.gezginScore,
      // Əvvəlki bazadan çox kiçikdirsə faiz mənasız olur (yeni istifadəçidə
      // 0 → 156 minlərlə faiz verər) — belə halda null qaytarırıq, ekran 29
      // göstəricini gizlədir.
      trendPercent: previousScore >= 20 ? Math.round((gainedScore / previousScore) * 100) : null,
      level: progress.level,
      tier: progress.tier.nameAz,
      tierCode: progress.tier.code,
      xp: user.xp,
      xpInLevel: progress.xpInLevel,
      xpForLevel: progress.xpForLevel,
      xpToNext: progress.xpToNext,
      percent: progress.percent,
      isMaxLevel: progress.isMax,
      last30Days: {
        xp: monthXp._sum.xp ?? 0,
        scoreDelta: gainedScore,
        byAction: thisMonth.map((a) => ({ action: a.action, count: a._count, xp: a._sum.xp ?? 0 })),
      },
      /** Ekran 29 "Xal qazanma yolları" */
      earnRules: this.rules().rules,
    };
  }

  /** Ekran 29 "Xal qazanma yolları" — `@gezgin/shared` qaydalarının açıq siyahısı. */
  rules() {
    return {
      rules: Object.entries(XP_RULES).map(([action, r]) => ({
        action,
        name: r.nameAz,
        xp: r.xp,
        dailyCap: r.dailyCap,
      })),
    };
  }

  /** Ekran 29 — XP tarixçəsi. */
  async history(userId: bigint, offset = 0, limit = 30) {
    const rows = await this.prisma.xpTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((t) => ({
        action: t.action,
        name: XP_RULES[t.action as keyof typeof XP_RULES]?.nameAz ?? t.action,
        xp: t.xp,
        scoreDelta: t.scoreDelta,
        levelAfter: t.levelAfter,
        targetType: t.targetType,
        note: t.note,
        createdAt: t.createdAt,
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 30 — level nərdivanı. */
  async levels(userId?: bigint) {
    const rows = await this.prisma.level.findMany({ orderBy: { level: 'asc' } });
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { level: true, xp: true } })
      : null;

    return {
      currentLevel: user?.level ?? null,
      currentXp: user?.xp ?? null,
      levels: rows.map((l) => ({
        level: l.level,
        tier: l.tierNameAz,
        tierCode: l.tierCode,
        xpRequired: l.xpRequired,
        reached: user ? user.level >= l.level : false,
      })),
    };
  }

  /** Ekran 30 — badge-lər və tərəqqi. */
  async badges(userId?: bigint) {
    const all = await this.prisma.badge.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    if (!userId) {
      return {
        earnedCount: 0,
        totalCount: all.length,
        badges: all.map((b) => ({
          slug: b.slug,
          name: b.nameAz,
          description: b.descriptionAz,
          icon: b.icon,
          tier: b.tier,
          conditionValue: b.conditionValue,
          progress: 0,
          percent: 0,
          earned: false,
          earnedAt: null,
        })),
      };
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } });
    await this.syncBadges(userId, user.level);

    const owned = await this.prisma.userBadge.findMany({ where: { userId } });
    const byBadge = new Map(owned.map((o) => [o.badgeId.toString(), o]));

    const badges = all.map((b) => {
      const o = byBadge.get(b.id.toString());
      const progress = o?.progress ?? 0;
      return {
        slug: b.slug,
        name: b.nameAz,
        description: b.descriptionAz,
        icon: b.icon,
        tier: b.tier,
        conditionValue: b.conditionValue,
        progress,
        percent: Math.min(100, Math.round((progress / b.conditionValue) * 100)),
        earned: o?.earnedAt != null,
        earnedAt: o?.earnedAt ?? null,
      };
    });

    return {
      earnedCount: badges.filter((b) => b.earned).length,
      totalCount: badges.length,
      badges,
    };
  }
}
