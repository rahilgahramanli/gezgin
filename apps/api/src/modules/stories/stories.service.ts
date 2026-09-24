import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaService } from '@/modules/media/media.service';
import { SocialGraphService, USER_CARD_SELECT, type UserCardRow } from '@/modules/community/social-graph.service';
import type { CreateStoryDto } from './dto/stories.dto';

/** Hekayə 24 saat yaşayır — sonra siyahılardan düşür (sətir qalır, statistika üçün). */
const STORY_TTL_MS = 24 * 3600_000;

interface Ring {
  user: UserCardRow;
  count: number;
  unseen: number;
  latestAt: Date;
  coverKey: string;
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: SocialGraphService,
    private readonly media: MediaService,
  ) {}

  private activeWhere(): Prisma.StoryWhereInput {
    return {
      deletedAt: null,
      expiresAt: { gt: new Date() },
      media: { deletedAt: null },
      user: { status: 'active', deletedAt: null },
    };
  }

  /**
   * Ekran 05 üst sırası: əvvəl öz hekayən, sonra izlədiklərin, sonra
   * populyar ictimai hesablar. Baxılmamış hekayəsi olanlar önə keçir.
   */
  async rings(viewerId?: bigint) {
    const [following, hidden] = await Promise.all([
      this.graph.followingIds(viewerId),
      this.graph.hiddenUserIds(viewerId),
    ]);

    const audience: Prisma.StoryWhereInput[] = [{ user: { isPublic: true } }];
    if (following.length) audience.push({ userId: { in: following } });
    if (viewerId !== undefined) audience.push({ userId: viewerId });

    const stories = await this.prisma.story.findMany({
      where: { ...this.activeWhere(), ...(hidden.length ? { userId: { notIn: hidden } } : {}), OR: audience },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        id: true,
        userId: true,
        createdAt: true,
        media: { select: { storageKey: true } },
        user: { select: USER_CARD_SELECT },
      },
    });

    const viewed =
      viewerId !== undefined && stories.length
        ? new Set(
            (
              await this.prisma.storyView.findMany({
                where: { userId: viewerId, storyId: { in: stories.map((s) => s.id) } },
                select: { storyId: true },
              })
            ).map((v) => v.storyId.toString()),
          )
        : new Set<string>();

    const byUser = new Map<string, Ring>();
    for (const s of stories) {
      const key = s.userId.toString();
      const ring = byUser.get(key) ?? {
        user: s.user,
        count: 0,
        unseen: 0,
        latestAt: s.createdAt,
        coverKey: s.media.storageKey,
      };
      ring.count += 1;
      if (!viewed.has(s.id.toString())) ring.unseen += 1;
      if (s.createdAt >= ring.latestAt) {
        ring.latestAt = s.createdAt;
        ring.coverKey = s.media.storageKey;
      }
      byUser.set(key, ring);
    }

    const followingSet = new Set(following.map((id) => id.toString()));
    const mine = viewerId?.toString();
    const rankOf = (userId: string) => (userId === mine ? 0 : followingSet.has(userId) ? 1 : 2);

    const data = [...byUser.entries()]
      .sort(
        ([aId, a], [bId, b]) =>
          rankOf(aId) - rankOf(bId) ||
          Number(b.unseen > 0) - Number(a.unseen > 0) ||
          b.latestAt.getTime() - a.latestAt.getTime(),
      )
      .slice(0, 30)
      .map(([userId, r]) => ({
        user: this.graph.card(r.user),
        storyCount: r.count,
        hasUnseen: r.unseen > 0,
        latestAt: r.latestAt,
        coverUrl: this.graph.url(r.coverKey),
        isMine: userId === mine,
      }));

    return { data, hasMine: data.some((r) => r.isMine) };
  }

  async create(userId: bigint, dto: CreateStoryDto) {
    const [media] = await this.media.ownedReady(userId, [dto.media]);
    if (!media) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Media tapılmadı' });

    const place = dto.place
      ? await this.prisma.place.findFirst({ where: { slug: dto.place, deletedAt: null }, select: { id: true } })
      : null;
    if (dto.place && !place) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Məkan tapılmadı: ${dto.place}` });
    }

    const story = await this.prisma.story.create({
      data: {
        publicId: ulid(),
        userId,
        mediaId: media.id,
        placeId: place?.id ?? null,
        caption: dto.caption?.trim() || null,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
      select: { publicId: true, expiresAt: true },
    });
    return { publicId: story.publicId, expiresAt: story.expiresAt };
  }

  /** Ekran 40 — istifadəçinin aktiv hekayələri, köhnədən yeniyə. */
  async forUser(username: string, viewerId?: bigint) {
    const user = await this.graph.findActive(username, viewerId);
    const isMe = viewerId === user.id;
    const allowed =
      isMe || user.isPublic || (viewerId !== undefined && (await this.graph.isFollowing(viewerId, user.id)));
    if (!allowed) return { user: this.graph.card(user), data: [] };

    const rows = await this.prisma.story.findMany({
      where: { ...this.activeWhere(), userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        media: { select: { storageKey: true, type: true, width: true, height: true } },
        views: { where: { userId: viewerId ?? 0n }, select: { userId: true } },
      },
    });

    // `stories.place_id` üçün Prisma əlaqəsi yoxdur — adlar ayrıca yüklənir
    const placeIds = [...new Set(rows.map((r) => r.placeId).filter((id): id is bigint => id !== null))];
    const places = placeIds.length
      ? await this.prisma.place.findMany({
          where: { id: { in: placeIds } },
          select: {
            id: true,
            slug: true,
            translations: { where: { lang: 'az' }, select: { name: true } },
            region: { select: { translations: { where: { lang: 'az' }, select: { name: true } } } },
          },
        })
      : [];
    const placeById = new Map(places.map((p) => [p.id.toString(), p]));

    return {
      user: this.graph.card(user),
      data: rows.map((s) => {
        const p = s.placeId !== null ? placeById.get(s.placeId.toString()) : undefined;
        return {
          publicId: s.publicId,
          mediaUrl: this.graph.url(s.media.storageKey),
          mediaType: s.media.type,
          width: s.media.width,
          height: s.media.height,
          caption: s.caption,
          place: p
            ? { slug: p.slug, name: p.translations[0]?.name ?? p.slug, region: p.region.translations[0]?.name ?? null }
            : null,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          viewed: s.views.length > 0,
          // Baxış sayını yalnız müəllif görür
          ...(isMe ? { viewCount: s.viewCount } : {}),
        };
      }),
    };
  }

  async view(viewerId: bigint, publicId: string) {
    const story = await this.prisma.story.findFirst({
      where: { publicId, ...this.activeWhere() },
      select: { id: true, userId: true },
    });
    if (!story || (await this.graph.isBlockedBetween(viewerId, story.userId))) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Hekayə tapılmadı və ya vaxtı bitib' });
    }
    // Müəllifin öz baxışı sayılmır
    if (story.userId === viewerId) return { viewed: true };

    const { count } = await this.prisma.storyView.createMany({
      data: [{ storyId: story.id, userId: viewerId }],
      skipDuplicates: true,
    });
    if (count) await this.prisma.story.update({ where: { id: story.id }, data: { viewCount: { increment: 1 } } });
    return { viewed: true };
  }

  async remove(userId: bigint, publicId: string) {
    const story = await this.prisma.story.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!story) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Hekayə tapılmadı' });
    if (story.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu hekayə sizə aid deyil' });
    }
    await this.prisma.story.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }
}
