import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { badgeText, pickTr, text, trWhere } from '@/common/i18n';
import { NotificationsService } from '@/modules/community/notifications.service';
import { ReportsService } from '@/modules/community/reports.service';
import { SocialGraphService, USER_CARD_SELECT, type UserCardRow } from '@/modules/community/social-graph.service';
import type { ReportDto } from '@/modules/community/dto/community.dto';
import { ERROR_CODES } from '@gezgin/shared';
import { PostsService } from '@/modules/posts/posts.service';
import type { UserListDto, UserPostsDto } from './dto/users.dto';

type ActiveUser = Awaited<ReturnType<SocialGraphService['findActive']>>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: SocialGraphService,
    private readonly posts: PostsService,
    private readonly notifications: NotificationsService,
    private readonly reports: ReportsService,
  ) {}

  /** Qapalı hesabın kontenti yalnız özünə və izləyicilərinə açıqdır. */
  private async canViewContent(user: ActiveUser, viewerId?: bigint): Promise<boolean> {
    if (user.isPublic || viewerId === user.id) return true;
    return viewerId !== undefined && this.graph.isFollowing(viewerId, user.id);
  }

  /** Ekran 41 — gezgin profili. */
  async profile(username: string, viewerId?: bigint) {
    const user = await this.graph.findActive(username, viewerId);
    const isMe = viewerId === user.id;

    const [extra, posts, followers, following, routes, badges, isFollowing, followsYou] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          bio: true,
          gezginScore: true,
          createdAt: true,
          cover: { select: { storageKey: true } },
          homeRegion: { select: { slug: true, translations: { where: trWhere(), select: { lang: true, name: true } } } },
          expertProfile: { select: { ratingAvg: true, ratingCount: true, experienceCount: true, specialties: true } },
        },
      }),
      this.prisma.post.count({ where: { userId: user.id, deletedAt: null } }),
      this.prisma.follow.count({ where: { followingId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      this.prisma.route.count({
        where: { authorId: user.id, deletedAt: null, ...(isMe ? {} : { visibility: { in: ['public', 'official'] } }) },
      }),
      this.prisma.userBadge.count({ where: { userId: user.id, earnedAt: { not: null } } }),
      viewerId !== undefined && !isMe ? this.graph.isFollowing(viewerId, user.id) : Promise.resolve(false),
      viewerId !== undefined && !isMe ? this.graph.isFollowing(user.id, viewerId) : Promise.resolve(false),
    ]);

    const expert = extra.expertProfile;
    return {
      ...this.graph.card(user),
      bio: extra.bio,
      coverUrl: this.graph.url(extra.cover?.storageKey),
      homeRegion: extra.homeRegion
        ? { slug: extra.homeRegion.slug, name: pickTr(extra.homeRegion.translations)?.name ?? extra.homeRegion.slug }
        : null,
      isPublic: user.isPublic,
      gezginScore: extra.gezginScore,
      stats: { posts, followers, following, routes, badges },
      expert: expert
        ? {
            rating: Number(expert.ratingAvg),
            ratingCount: expert.ratingCount,
            experienceCount: expert.experienceCount,
            specialties: expert.specialties ? expert.specialties.split('|') : [],
          }
        : null,
      viewer: { isMe, isFollowing, followsYou, canMessage: viewerId !== undefined && !isMe },
      canViewContent: user.isPublic || isMe || isFollowing,
      joinedAt: extra.createdAt,
    };
  }

  async userPosts(username: string, dto: UserPostsDto, viewerId?: bigint) {
    const user = await this.graph.findActive(username, viewerId);
    return this.posts.byAuthor(user.id, viewerId, dto.cursor, dto.limit ?? 20);
  }

  /** Ekran 41 "Marşrutlar" — başqasına yalnız ictimai olanlar görünür. */
  async routes(username: string, dto: UserListDto, viewerId?: bigint) {
    const user = await this.graph.findActive(username, viewerId);
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;
    const where: Prisma.RouteWhereInput = {
      authorId: user.id,
      deletedAt: null,
      ...(viewerId === user.id ? {} : { visibility: { in: ['public', 'official'] } }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        orderBy: [{ copyCount: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit + 1,
        include: {
          translations: { where: trWhere(), select: { lang: true, title: true } },
          region: { select: { slug: true, translations: { where: trWhere(), select: { lang: true, name: true } } } },
          cover: { select: { storageKey: true } },
          _count: { select: { stops: true } },
        },
      }),
      this.prisma.route.count({ where }),
    ]);

    return {
      data: rows.slice(0, limit).map((r) => ({
        slug: r.slug,
        title: pickTr(r.translations)?.title ?? r.slug,
        days: r.days,
        difficulty: r.difficulty,
        categories: r.categories ? r.categories.split('|') : [],
        stopCount: r._count.stops,
        rating: Number(r.ratingAvg),
        ratingCount: r.ratingCount,
        copyCount: r.copyCount,
        visibility: r.visibility,
        coverUrl: this.graph.url(r.cover?.storageKey),
        region: { slug: r.region.slug, name: pickTr(r.region.translations)?.name ?? r.region.slug },
      })),
      nextOffset: rows.length > limit ? offset + limit : null,
      total,
    };
  }

  /** Ekran 41 "Nailiyyətlər" — `/me/badges` ilə eyni sahələr. */
  async badges(username: string, viewerId?: bigint) {
    const user = await this.graph.findActive(username, viewerId);
    const [badges, owned] = await Promise.all([
      this.prisma.badge.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
      this.prisma.userBadge.findMany({ where: { userId: user.id } }),
    ]);
    const byBadge = new Map(owned.map((o) => [o.badgeId.toString(), o]));

    const items = badges
      .map((b) => {
        const mine = byBadge.get(b.id.toString());
        const progress = Math.min(mine?.progress ?? 0, b.conditionValue);
        return {
          slug: b.slug,
          ...badgeText(b),
          icon: b.icon,
          tier: b.tier,
          conditionValue: b.conditionValue,
          progress,
          percent: b.conditionValue ? Math.round((progress / b.conditionValue) * 100) : 0,
          earned: mine?.earnedAt != null,
          earnedAt: mine?.earnedAt ?? null,
        };
      })
      .sort((a, b) => Number(b.earned) - Number(a.earned));

    return { earnedCount: items.filter((i) => i.earned).length, totalCount: items.length, badges: items };
  }

  /** Ekran 42. Bloklama əlaqəsi olanlar siyahıda görünmür. */
  async followList(username: string, kind: 'followers' | 'following', dto: UserListDto, viewerId?: bigint) {
    const user = await this.graph.findActive(username, viewerId);
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;
    const hidden = await this.graph.hiddenUserIds(viewerId);

    const activeUser = { deletedAt: null, status: 'active' as const };
    const where: Prisma.FollowWhereInput =
      kind === 'followers'
        ? { followingId: user.id, follower: activeUser, ...(hidden.length ? { followerId: { notIn: hidden } } : {}) }
        : { followerId: user.id, following: activeUser, ...(hidden.length ? { followingId: { notIn: hidden } } : {}) };

    const total = await this.prisma.follow.count({ where });
    if (!(await this.canViewContent(user, viewerId))) return { data: [], nextOffset: null, total };

    const page = { where, orderBy: { createdAt: 'desc' as const }, skip: offset, take: limit + 1 };
    const people: UserCardRow[] =
      kind === 'followers'
        ? (await this.prisma.follow.findMany({ ...page, include: { follower: { select: USER_CARD_SELECT } } })).map(
            (r) => r.follower,
          )
        : (await this.prisma.follow.findMany({ ...page, include: { following: { select: USER_CARD_SELECT } } })).map(
            (r) => r.following,
          );

    return {
      data: await this.withViewer(people.slice(0, limit), viewerId),
      nextOffset: people.length > limit ? offset + limit : null,
      total,
    };
  }

  private async withViewer(people: UserCardRow[], viewerId?: bigint) {
    const following = new Set((await this.graph.followingIds(viewerId)).map((id) => id.toString()));
    return people.map((p) => ({
      ...this.graph.card(p),
      isFollowing: following.has(p.id.toString()),
      isMe: viewerId === p.id,
    }));
  }

  async follow(viewer: { id: bigint; username: string }, username: string) {
    const target = await this.graph.findActive(username, viewer.id);
    if (target.id === viewer.id) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Özünüzü izləyə bilməzsiniz' });
    }

    const { count } = await this.prisma.follow.createMany({
      data: [{ followerId: viewer.id, followingId: target.id }],
      skipDuplicates: true,
    });
    if (count) {
      await this.notifications.notify({
        userId: target.id,
        actorId: viewer.id,
        type: 'social_follow',
        title: '{actor} səni izləməyə başladı',
        targetType: 'user',
        targetId: viewer.id,
        deepLink: `gezgin://user/${viewer.username}`,
        dedupeMinutes: 24 * 60,
      });
    }
    return { following: true, followers: await this.prisma.follow.count({ where: { followingId: target.id } }) };
  }

  async unfollow(viewerId: bigint, username: string) {
    const target = await this.graph.findActive(username, viewerId);
    await this.prisma.follow.deleteMany({ where: { followerId: viewerId, followingId: target.id } });
    return { following: false, followers: await this.prisma.follow.count({ where: { followingId: target.id } }) };
  }

  /** Ekran 42 "Tövsiyə olunan gezginlər" — eyni region və ortaq maraqlar önə çəkilir. */
  async suggested(viewerId: bigint, limit = 10) {
    const [following, hidden, me] = await Promise.all([
      this.graph.followingIds(viewerId),
      this.graph.hiddenUserIds(viewerId),
      this.prisma.user.findUniqueOrThrow({
        where: { id: viewerId },
        select: { homeRegionId: true, interests: { select: { categoryId: true } } },
      }),
    ]);

    const candidates = await this.prisma.user.findMany({
      where: { id: { notIn: [viewerId, ...following, ...hidden] }, deletedAt: null, status: 'active', isPublic: true },
      orderBy: [{ gezginScore: 'desc' }, { id: 'asc' }],
      take: 50,
      select: {
        ...USER_CARD_SELECT,
        homeRegionId: true,
        homeRegion: { select: { translations: { where: trWhere(), select: { lang: true, name: true } } } },
        interests: { select: { categoryId: true } },
      },
    });

    const myInterests = new Set(me.interests.map((i) => i.categoryId.toString()));
    const ranked = candidates
      .map((c, index) => {
        const sameRegion = me.homeRegionId !== null && c.homeRegionId === me.homeRegionId;
        const shared = c.interests.filter((i) => myInterests.has(i.categoryId.toString())).length;
        // `index` Gezgin Score sırasını bərabərlikdə qoruyur
        return { c, sameRegion, shared, rank: (sameRegion ? 100 : 0) + shared * 10 - index * 0.01 };
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit);

    return {
      data: ranked.map(({ c, sameRegion, shared }) => ({
        ...this.graph.card(c),
        region: pickTr(c.homeRegion?.translations)?.name ?? null,
        isFollowing: false,
        reason: text(sameRegion ? 'fromYourRegion' : shared ? 'sharedInterests' : 'popularGezgin'),
      })),
    };
  }

  async report(viewerId: bigint, username: string, dto: ReportDto) {
    const target = await this.graph.findActive(username, viewerId);
    return this.reports.report(viewerId, { type: 'user', id: target.id, ownerId: target.id }, dto);
  }
}
