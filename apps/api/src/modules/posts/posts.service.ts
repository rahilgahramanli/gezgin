import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { pickTr, text, trWhere } from '@/common/i18n';
import { distanceMeters, formatDistanceKm, withinRadius } from '@/common/search/geo';
import { XpService } from '@/modules/gamification/xp.service';
import { MediaService } from '@/modules/media/media.service';
import { NotificationsService } from '@/modules/community/notifications.service';
import { ReportsService } from '@/modules/community/reports.service';
import { SocialGraphService, USER_CARD_SELECT } from '@/modules/community/social-graph.service';
import type { ReportDto } from '@/modules/community/dto/community.dto';
import type { CreatePostDto, FeedDto, UpdatePostDto } from './dto/posts.dto';
import { extractHashtags } from './hashtags';

/** Paylaşım linki — veb tərəf `/p/:id` açır, tətbiq quraşdırılıbsa deep link-ə yönləndirir. */
const SHARE_BASE_URL = 'https://gezgin.app/p';

const postInclude = (viewerId: bigint) =>
  ({
    user: { select: USER_CARD_SELECT },
    media: {
      where: { media: { deletedAt: null } },
      include: { media: { select: { storageKey: true, type: true, width: true, height: true, blurhash: true } } },
      orderBy: { sortOrder: 'asc' },
    },
    place: {
      select: {
        slug: true,
        ratingAvg: true,
        translations: { where: trWhere(), select: { lang: true, name: true } },
        region: { select: { slug: true, translations: { where: trWhere(), select: { lang: true, name: true } } } },
      },
    },
    route: { select: { slug: true, days: true, translations: { where: trWhere(), select: { lang: true, title: true } } } },
    // Anonim baxışda `0n` heç bir sətrə uyğun gəlmir — şərtli include tipi mürəkkəbləşdirərdi
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) satisfies Prisma.PostInclude;

export type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: SocialGraphService,
    private readonly notifications: NotificationsService,
    private readonly reports: ReportsService,
    private readonly media: MediaService,
    private readonly xp: XpService,
  ) {}

  // ─────────────────── görünürlük ───────────────────

  /**
   * Kim nəyi görür:
   * - `public` — hamı (qapalı hesabın paylaşımı isə yalnız izləyicilərə);
   * - `followers` — izləyicilər;
   * - `private` — yalnız müəllif.
   * Bloklama əlaqəsi olan istifadəçilərin paylaşımı heç vaxt görünmür.
   */
  private visibilityWhere(viewerId: bigint | undefined, following: bigint[], hidden: bigint[]): Prisma.PostWhereInput {
    const audience: Prisma.PostWhereInput[] = [{ visibility: 'public', user: { isPublic: true } }];
    if (following.length) audience.push({ visibility: { in: ['public', 'followers'] }, userId: { in: following } });
    if (viewerId !== undefined) audience.push({ userId: viewerId });

    return {
      deletedAt: null,
      user: { status: 'active', deletedAt: null },
      ...(hidden.length ? { userId: { notIn: hidden } } : {}),
      OR: audience,
    };
  }

  private async audience(viewerId?: bigint) {
    const [following, hidden] = await Promise.all([
      this.graph.followingIds(viewerId),
      this.graph.hiddenUserIds(viewerId),
    ]);
    return { following, where: this.visibilityWhere(viewerId, following, hidden) };
  }

  /** Görmək icazəsi yoxdursa 404 — lentdəki eyni qayda, mövcudluq açıqlanmır. */
  async findVisible(publicId: string, viewerId?: bigint): Promise<PostRow> {
    const { where } = await this.audience(viewerId);
    const post = await this.prisma.post.findFirst({
      where: { AND: [where, { publicId }] },
      include: postInclude(viewerId ?? 0n),
    });
    if (!post) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Paylaşım tapılmadı' });
    return post;
  }

  // ─────────────────── oxu ───────────────────

  /**
   * Keyset səhifələmə `(createdAt, id)` üzrə — yeni paylaşım gələndə offset
   * kimi təkrar və ya itən sətir yaranmır. Seed paylaşımlarının `createdAt`-ı
   * keçmişə çəkildiyi üçün tək `id` sırası kifayət etmir.
   */
  private async keyset(cursor?: string): Promise<Prisma.PostWhereInput | null> {
    if (!cursor) return null;
    const c = await this.prisma.post.findUnique({ where: { publicId: cursor }, select: { id: true, createdAt: true } });
    if (!c) throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Yanlış cursor' });
    return { OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] };
  }

  private async page(and: Prisma.PostWhereInput[], limit: number, viewerId?: bigint, distances?: Map<string, number>) {
    const rows = await this.prisma.post.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: postInclude(viewerId ?? 0n),
    });
    const page = rows.slice(0, limit);
    return {
      data: await this.shape(page, viewerId, distances),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.publicId ?? null) : null,
    };
  }

  /** Ekran 05 — For you / Following / Nearby. */
  async feed(dto: FeedDto, viewerId?: bigint) {
    const tab = dto.tab ?? 'for_you';
    const limit = dto.limit ?? 20;
    if (tab === 'following' && viewerId === undefined) return { tab, data: [], nextCursor: null };

    const { following, where } = await this.audience(viewerId);
    const and: Prisma.PostWhereInput[] = [where];
    let distances: Map<string, number> | undefined;

    if (tab === 'following' && viewerId !== undefined) {
      and.push({ userId: { in: [...following, viewerId] } });
    } else if (tab === 'nearby') {
      if (dto.lat === undefined || dto.lng === undefined) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Yaxınlıq lenti üçün lat və lng lazımdır',
        });
      }
      const radiusM = (dto.radiusKm ?? 50) * 1000;
      // `geo` Prisma sxemində yoxdur (bax: *_geo_spatial) — namizədlər xam SQL ilə
      const near = await this.prisma.$queryRaw<Array<{ id: bigint; d: number }>>`
        SELECT p.id, ${distanceMeters('p.geo', dto.lng, dto.lat)} AS d
        FROM posts p
        WHERE p.deleted_at IS NULL AND p.lat IS NOT NULL
          AND ${withinRadius('p.geo', dto.lng, dto.lat, radiusM)}
        ORDER BY p.created_at DESC
        LIMIT 500
      `;
      distances = new Map(near.map((n) => [n.id.toString(), Number(n.d)]));
      and.push({ id: { in: near.map((n) => n.id) } });
    }

    const ks = await this.keyset(dto.cursor);
    if (ks) and.push(ks);

    return { tab, ...(await this.page(and, limit, viewerId, distances)) };
  }

  /** Ekran 41 "Paylaşımlar" tabı — eyni görünürlük qaydası ilə. */
  async byAuthor(authorId: bigint, viewerId: bigint | undefined, cursor?: string, limit = 20) {
    const { where } = await this.audience(viewerId);
    const and: Prisma.PostWhereInput[] = [where, { userId: authorId }];
    const ks = await this.keyset(cursor);
    if (ks) and.push(ks);
    return this.page(and, limit, viewerId);
  }

  async detail(publicId: string, viewerId?: bigint) {
    const post = await this.findVisible(publicId, viewerId);
    const [saved, followsAuthor] =
      viewerId !== undefined
        ? await Promise.all([
            this.prisma.savedItem
              .count({ where: { userId: viewerId, targetType: 'post', targetId: post.id } })
              .then((n) => n > 0),
            this.graph.isFollowing(viewerId, post.userId),
          ])
        : [false, false];
    return this.card(post, viewerId, saved, followsAuthor);
  }

  private async shape(rows: PostRow[], viewerId?: bigint, distances?: Map<string, number>) {
    if (!rows.length) return [];
    const [saved, following] = await Promise.all([
      viewerId !== undefined
        ? this.prisma.savedItem.findMany({
            where: { userId: viewerId, targetType: 'post', targetId: { in: rows.map((r) => r.id) } },
            select: { targetId: true },
          })
        : Promise.resolve([]),
      this.graph.followingIds(viewerId),
    ]);
    const savedSet = new Set(saved.map((s) => s.targetId.toString()));
    const followingSet = new Set(following.map((id) => id.toString()));

    return rows.map((r) =>
      this.card(
        r,
        viewerId,
        savedSet.has(r.id.toString()),
        followingSet.has(r.userId.toString()),
        distances?.get(r.id.toString()),
      ),
    );
  }

  private card(r: PostRow, viewerId: bigint | undefined, saved: boolean, followsAuthor: boolean, distanceM?: number) {
    const placeName = pickTr(r.place?.translations)?.name ?? null;
    const regionName = pickTr(r.place?.region.translations)?.name ?? null;

    return {
      publicId: r.publicId,
      body: r.body,
      hashtags: r.hashtags ? r.hashtags.split('|') : [],
      visibility: r.visibility,
      createdAt: r.createdAt,
      author: this.graph.card(r.user),
      media: r.media.map((m) => ({
        url: this.graph.url(m.media.storageKey),
        type: m.media.type,
        width: m.media.width,
        height: m.media.height,
        blurhash: m.media.blurhash,
      })),
      place: r.place
        ? { slug: r.place.slug, name: placeName ?? r.place.slug, region: regionName, rating: Number(r.place.ratingAvg) }
        : null,
      route: r.route
        ? { slug: r.route.slug, title: pickTr(r.route.translations)?.title ?? r.route.slug, days: r.route.days }
        : null,
      /** Ekran 05 başlığındakı "Quba, Azərbaycan". */
      location: regionName ? `${regionName}, ${text('azerbaijan')}` : null,
      counts: { likes: r.likeCount, comments: r.commentCount, shares: r.shareCount, saves: r.saveCount },
      viewer: {
        liked: r.likes.length > 0,
        saved,
        followsAuthor,
        isMine: viewerId !== undefined && viewerId === r.userId,
      },
      ...(distanceM !== undefined ? { distanceKm: formatDistanceKm(distanceM) } : {}),
    };
  }

  // ─────────────────── yazma ───────────────────

  /** Ekran 26. Foto/video ilə paylaşım +300 XP verir (gündə 5 dəfə). */
  async create(userId: bigint, dto: CreatePostDto) {
    const body = dto.body?.trim() || null;
    const mediaIds = [...new Set(dto.media ?? [])];
    if (!body && !mediaIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Paylaşım üçün mətn və ya foto lazımdır',
      });
    }

    const media = await this.media.ownedReady(userId, mediaIds);

    const place = dto.place
      ? await this.prisma.place.findFirst({
          where: { slug: dto.place, deletedAt: null },
          select: { id: true, lat: true, lng: true },
        })
      : null;
    if (dto.place && !place) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.place}` });
    }

    // Başqasının şəxsi marşrutuna bağlamaq olmaz
    const route = dto.route
      ? await this.prisma.route.findFirst({
          where: {
            slug: dto.route,
            deletedAt: null,
            OR: [{ visibility: { in: ['public', 'official'] } }, { authorId: userId }],
          },
          select: { id: true },
        })
      : null;
    if (dto.route && !route) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${dto.route}` });
    }

    // Koordinat verilməyibsə məkanınkı götürülür — Nearby lenti bundan asılıdır
    const lat = dto.lat ?? (place ? Number(place.lat) : null);
    const lng = dto.lng ?? (place ? Number(place.lng) : null);
    const hashtags = extractHashtags(body);

    const post = await this.prisma.post.create({
      data: {
        publicId: ulid(),
        userId,
        placeId: place?.id ?? null,
        routeId: route?.id ?? null,
        visibility: dto.visibility ?? 'public',
        body,
        hashtags: hashtags.length ? hashtags.join('|') : null,
        lat: lat === null ? null : new Prisma.Decimal(lat),
        lng: lng === null ? null : new Prisma.Decimal(lng),
        media: { create: media.map((m, i) => ({ mediaId: m.id, sortOrder: i })) },
      },
    });

    const rewards = media.length
      ? await this.xp.award(userId, 'media_shared', { type: 'post', id: post.id, note: body?.slice(0, 80) })
      : null;

    return { ...(await this.detail(post.publicId, userId)), rewards };
  }

  private async ownPost(userId: bigint, publicId: string) {
    const post = await this.prisma.post.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!post) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Paylaşım tapılmadı' });
    if (post.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu paylaşım sizə aid deyil' });
    }
    return post;
  }

  async update(userId: bigint, publicId: string, dto: UpdatePostDto) {
    const post = await this.ownPost(userId, publicId);

    let placeId: bigint | null | undefined;
    if (dto.place !== undefined) {
      if (dto.place === '') {
        placeId = null;
      } else {
        const place = await this.prisma.place.findFirst({
          where: { slug: dto.place, deletedAt: null },
          select: { id: true },
        });
        if (!place) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.place}` });
        placeId = place.id;
      }
    }

    const body = dto.body !== undefined ? dto.body.trim() || null : undefined;
    if (body === null && (await this.prisma.postMedia.count({ where: { postId: post.id } })) === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Fotosuz paylaşımın mətni boş ola bilməz',
      });
    }

    await this.prisma.post.update({
      where: { id: post.id },
      data: {
        ...(body !== undefined ? { body, hashtags: extractHashtags(body).join('|') || null } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(placeId !== undefined ? { placeId } : {}),
      },
    });
    return this.detail(publicId, userId);
  }

  async remove(userId: bigint, publicId: string) {
    const post = await this.ownPost(userId, publicId);
    await this.prisma.$transaction([
      this.prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } }),
      // Ekran 33 silinmiş paylaşımı həll edə bilmir — saxlanılan sətirlər də gedir
      this.prisma.savedItem.deleteMany({ where: { targetType: 'post', targetId: post.id } }),
    ]);
    return { deleted: true };
  }

  // ─────────────────── qarşılıqlı əlaqə ───────────────────

  /** `createMany + skipDuplicates` — iki paralel toxunuş sayğacı iki dəfə artırmır. */
  async setLike(userId: bigint, publicId: string, like: boolean) {
    const post = await this.findVisible(publicId, userId);

    if (like) {
      const { count } = await this.prisma.postLike.createMany({
        data: [{ postId: post.id, userId }],
        skipDuplicates: true,
      });
      if (count) {
        await this.prisma.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } });
        await this.notifications.notify({
          userId: post.userId,
          actorId: userId,
          type: 'social_like',
          title: '{actor} paylaşımını bəyəndi',
          targetType: 'post',
          targetId: post.id,
          deepLink: `gezgin://post/${post.publicId}`,
          imageUrl: this.firstMediaUrl(post),
          dedupeMinutes: 24 * 60,
        });
      }
    } else {
      const { count } = await this.prisma.postLike.deleteMany({ where: { postId: post.id, userId } });
      if (count) await this.prisma.post.update({ where: { id: post.id }, data: { likeCount: { decrement: 1 } } });
    }

    const { likeCount } = await this.prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      select: { likeCount: true },
    });
    return { liked: like, likeCount };
  }

  /** Saxlanılanlar cədvəli ümumidir (ekran 33) — paylaşım da ora düşür. */
  async setSaved(userId: bigint, publicId: string, save: boolean) {
    const post = await this.findVisible(publicId, userId);

    if (save) {
      const { count } = await this.prisma.savedItem.createMany({
        data: [{ userId, targetType: 'post', targetId: post.id }],
        skipDuplicates: true,
      });
      if (count) await this.prisma.post.update({ where: { id: post.id }, data: { saveCount: { increment: 1 } } });
    } else {
      const { count } = await this.prisma.savedItem.deleteMany({
        where: { userId, targetType: 'post', targetId: post.id },
      });
      if (count) await this.prisma.post.update({ where: { id: post.id }, data: { saveCount: { decrement: 1 } } });
    }

    const { saveCount } = await this.prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      select: { saveCount: true },
    });
    return { saved: save, saveCount };
  }

  /** Ekran 43 — link qaytarır və sayğacı artırır; hansı kanalla göndərildiyi mobildədir. */
  async share(userId: bigint, publicId: string) {
    const post = await this.findVisible(publicId, userId);
    const { shareCount } = await this.prisma.post.update({
      where: { id: post.id },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return { shareUrl: `${SHARE_BASE_URL}/${post.publicId}`, shareCount };
  }

  async report(userId: bigint, publicId: string, dto: ReportDto) {
    const post = await this.findVisible(publicId, userId);
    return this.reports.report(userId, { type: 'post', id: post.id, ownerId: post.userId }, dto);
  }

  firstMediaUrl(post: PostRow): string | null {
    const first = post.media[0];
    return first ? this.graph.url(first.media.storageKey) : null;
  }
}
