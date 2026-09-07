import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewTargetType } from '@prisma/client';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import type { ListReviewsDto } from './dto/reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  /** Rəylər polimorfikdir — slug-ı daxili ID-yə çeviririk. */
  private async resolveTarget(type: ReviewTargetType, slug: string): Promise<bigint> {
    const finders: Record<ReviewTargetType, () => Promise<{ id: bigint } | null>> = {
      place: () => this.prisma.place.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }),
      route: () => this.prisma.route.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }),
      experience: () => this.prisma.experience.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }),
      business: () => this.prisma.business.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }),
      event: () => this.prisma.event.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }),
    };
    const found = await finders[type]();
    if (!found) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Tapılmadı: ${type}/${slug}` });
    return found.id;
  }

  /** Ekran 47 — rəy siyahısı. */
  async list(dto: ListReviewsDto, viewerId?: bigint) {
    const targetId = await this.resolveTarget(dto.targetType, dto.target);
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const where = {
      targetType: dto.targetType,
      targetId,
      deletedAt: null,
      isVisible: true,
      ...(dto.rating ? { rating: dto.rating } : {}),
      ...(dto.withPhotos === 'true' ? { photos: { some: {} } } : {}),
    };

    const orderBy = {
      newest: { createdAt: 'desc' as const },
      highest: { rating: 'desc' as const },
      lowest: { rating: 'asc' as const },
      helpful: { helpfulCount: 'desc' as const },
    }[dto.sort ?? 'newest'];

    const rows = await this.prisma.review.findMany({
      where,
      orderBy: [orderBy, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: {
        user: {
          select: {
            username: true, fullName: true, level: true, role: true,
            avatar: { select: { storageKey: true } },
          },
        },
        photos: { include: { media: { select: { storageKey: true, blurhash: true } } }, orderBy: { sortOrder: 'asc' } },
        replies: {
          where: { deletedAt: null },
          include: { user: { select: { username: true, fullName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        ...(viewerId ? { helpful: { where: { userId: viewerId }, select: { userId: true } } } : {}),
      },
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((r) => ({
        publicId: r.publicId,
        rating: r.rating,
        body: r.body,
        tags: r.tags ? r.tags.split('|') : [],
        helpfulCount: r.helpfulCount,
        markedHelpful: viewerId ? (r as { helpful?: unknown[] }).helpful?.length === 1 : false,
        createdAt: r.createdAt,
        author: {
          username: r.user.username,
          fullName: r.user.fullName,
          level: r.user.level,
          isLocalExpert: r.user.role === 'local_expert',
          avatarUrl: this.url(r.user.avatar?.storageKey),
        },
        photos: r.photos.map((p) => ({ url: this.url(p.media.storageKey), blurhash: p.media.blurhash })),
        replies: r.replies.map((rep) => ({
          body: rep.body,
          createdAt: rep.createdAt,
          author: { username: rep.user.username, fullName: rep.user.fullName, role: rep.user.role },
        })),
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 47 üst kartı — ulduz bölgüsü. */
  async summary(targetType: ReviewTargetType, target: string) {
    const targetId = await this.resolveTarget(targetType, target);

    const groups = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { targetType, targetId, deletedAt: null, isVisible: true },
      _count: { rating: true },
    });

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of groups) counts[g.rating] = g._count.rating;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const sum = Object.entries(counts).reduce((a, [star, n]) => a + Number(star) * n, 0);

    const withPhotos = await this.prisma.review.count({
      where: { targetType, targetId, deletedAt: null, isVisible: true, photos: { some: {} } },
    });

    return {
      average: total ? Math.round((sum / total) * 10) / 10 : 0,
      total,
      withPhotos,
      breakdown: [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: counts[star],
        percent: total ? Math.round((counts[star] / total) * 100) : 0,
      })),
    };
  }

  /** Ekran 47 "Faydalı" düyməsi. */
  async markHelpful(userId: bigint, publicId: string, helpful: boolean) {
    const review = await this.prisma.review.findFirst({ where: { publicId, deletedAt: null }, select: { id: true } });
    if (!review) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rəy tapılmadı' });

    const existing = await this.prisma.reviewHelpful.findUnique({
      where: { reviewId_userId: { reviewId: review.id, userId } },
    });

    if (helpful && !existing) {
      await this.prisma.$transaction([
        this.prisma.reviewHelpful.create({ data: { reviewId: review.id, userId } }),
        this.prisma.review.update({ where: { id: review.id }, data: { helpfulCount: { increment: 1 } } }),
      ]);
    } else if (!helpful && existing) {
      await this.prisma.$transaction([
        this.prisma.reviewHelpful.delete({ where: { reviewId_userId: { reviewId: review.id, userId } } }),
        this.prisma.review.update({ where: { id: review.id }, data: { helpfulCount: { decrement: 1 } } }),
      ]);
    }

    const updated = await this.prisma.review.findUniqueOrThrow({
      where: { id: review.id },
      select: { helpfulCount: true },
    });
    return { markedHelpful: helpful, helpfulCount: updated.helpfulCount };
  }
}
