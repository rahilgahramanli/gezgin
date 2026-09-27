import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ReviewTargetType } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { MediaService } from '@/modules/media/media.service';
import { XpService } from '@/modules/gamification/xp.service';
import type { CreateReviewDto, ListReviewsDto, UpdateReviewDto } from './dto/reviews.dto';

const reviewInclude = (viewerId: bigint) =>
  ({
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
    // Anonim baxışda `0n` heç bir sətrə uyğun gəlmir
    helpful: { where: { userId: viewerId }, select: { userId: true } },
  }) satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: ReturnType<typeof reviewInclude> }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly xp: XpService,
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

  private shape(r: ReviewRow, viewerId?: bigint) {
    return {
      publicId: r.publicId,
      rating: r.rating,
      body: r.body,
      tags: r.tags ? r.tags.split('|') : [],
      helpfulCount: r.helpfulCount,
      markedHelpful: r.helpful.length === 1,
      isMine: viewerId !== undefined && r.userId === viewerId,
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
    };
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
      // Ekran 47 "4+" çipi — minimal ulduz, dəqiq bərabərlik deyil
      ...(dto.rating ? { rating: { gte: dto.rating } } : {}),
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
      include: reviewInclude(viewerId ?? 0n),
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit).map((r) => this.shape(r, viewerId)),
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

  // ─────────────────── yazma (ekran 27) ───────────────────

  private tagString(tags?: string[]): string | null {
    return tags?.length ? [...new Set(tags)].join('|') : null;
  }

  private async one(id: bigint, viewerId: bigint) {
    const row = await this.prisma.review.findUniqueOrThrow({ where: { id }, include: reviewInclude(viewerId) });
    return this.shape(row, viewerId);
  }

  /** Hər obyekt üçün bir rəy — ikincisi 409, mobil redaktəyə yönləndirir. */
  async create(userId: bigint, dto: CreateReviewDto) {
    const targetId = await this.resolveTarget(dto.targetType, dto.target);
    const existing = await this.prisma.review.findUnique({
      where: { userId_targetType_targetId: { userId, targetType: dto.targetType, targetId } },
      select: { id: true, publicId: true, deletedAt: true },
    });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: 'Bu obyekt üçün artıq rəy yazmısınız — redaktə edə bilərsiniz',
        details: { publicId: existing.publicId },
      });
    }

    const photos = await this.media.ownedReady(userId, [...new Set(dto.photos ?? [])]);
    const data = {
      rating: dto.rating,
      body: dto.body?.trim() || null,
      tags: this.tagString(dto.tags),
      isVisible: true,
      deletedAt: null,
      helpfulCount: 0,
    };

    const review = await this.prisma.$transaction(async (tx) => {
      // Silinmiş rəy unikal açarı tutur — yenidən yazanda həmin sətir dirçəlir
      const row = existing
        ? await tx.review.update({ where: { id: existing.id }, data: { ...data, createdAt: new Date() } })
        : await tx.review.create({
            data: { publicId: ulid(), userId, targetType: dto.targetType, targetId, ...data },
          });
      if (existing) {
        await tx.reviewPhoto.deleteMany({ where: { reviewId: row.id } });
        await tx.reviewHelpful.deleteMany({ where: { reviewId: row.id } });
      }
      if (photos.length) {
        await tx.reviewPhoto.createMany({
          data: photos.map((p, i) => ({ reviewId: row.id, mediaId: p.id, sortOrder: i })),
        });
      }
      return row;
    });

    await this.recomputeRating(dto.targetType, targetId);

    // Dirçəlmiş rəy XP-ni təkrar vermir — silib-yazmaqla XP yığılmasın
    const rewards = existing
      ? null
      : await this.xp.award(userId, 'review_written', { type: 'review', id: review.id, note: dto.body?.slice(0, 80) });

    return { ...(await this.one(review.id, userId)), rewards };
  }

  private async ownReview(userId: bigint, publicId: string) {
    const review = await this.prisma.review.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, userId: true, targetType: true, targetId: true },
    });
    if (!review) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rəy tapılmadı' });
    if (review.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu rəy sizə aid deyil' });
    }
    return review;
  }

  async update(userId: bigint, publicId: string, dto: UpdateReviewDto) {
    const review = await this.ownReview(userId, publicId);
    await this.prisma.review.update({
      where: { id: review.id },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() || null } : {}),
        ...(dto.tags !== undefined ? { tags: this.tagString(dto.tags) } : {}),
      },
    });
    if (dto.rating !== undefined) await this.recomputeRating(review.targetType, review.targetId);
    return this.one(review.id, userId);
  }

  async remove(userId: bigint, publicId: string) {
    const review = await this.ownReview(userId, publicId);
    await this.prisma.review.update({ where: { id: review.id }, data: { deletedAt: new Date() } });
    await this.recomputeRating(review.targetType, review.targetId);
    return { deleted: true };
  }

  /**
   * Obyektin reytinq aqreqatı — siyahılar və sıralama onu oxuyur, hesablamır.
   * Sprint 7-yə qədər rəyi yalnız seed yazırdı və aqreqatı da o hesablayırdı.
   */
  private async recomputeRating(type: ReviewTargetType, targetId: bigint): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { targetType: type, targetId, deletedAt: null, isVisible: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const data = {
      ratingAvg: new Prisma.Decimal(Math.round((agg._avg.rating ?? 0) * 100) / 100),
      ratingCount: agg._count.rating,
    };

    if (type === 'place') await this.prisma.place.update({ where: { id: targetId }, data });
    else if (type === 'route') await this.prisma.route.update({ where: { id: targetId }, data });
    else if (type === 'business') await this.prisma.business.update({ where: { id: targetId }, data });
    else if (type === 'experience') {
      const exp = await this.prisma.experience.update({ where: { id: targetId }, data, select: { expertId: true } });
      await this.recomputeExpert(exp.expertId);
    }
    // `events` cədvəlində reytinq sütunu yoxdur
  }

  /** Local Expert profil reytinqi — təcrübələrinin çəkili ortalaması (seed ilə eyni düstur). */
  private async recomputeExpert(expertId: bigint): Promise<void> {
    const exps = await this.prisma.experience.findMany({
      where: { expertId, deletedAt: null, ratingCount: { gt: 0 } },
      select: { ratingAvg: true, ratingCount: true },
    });
    const total = exps.reduce((n, x) => n + x.ratingCount, 0);
    const sum = exps.reduce((n, x) => n + Number(x.ratingAvg) * x.ratingCount, 0);
    await this.prisma.expertProfile.updateMany({
      where: { userId: expertId },
      data: {
        ratingAvg: new Prisma.Decimal(total ? Math.round((sum / total) * 100) / 100 : 0),
        ratingCount: total,
      },
    });
  }
}
