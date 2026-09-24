import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotificationsService } from '@/modules/community/notifications.service';
import { SocialGraphService, USER_CARD_SELECT } from '@/modules/community/social-graph.service';
import { PostsService } from './posts.service';
import type { CommentsQueryDto, CreateCommentDto } from './dto/posts.dto';

const commentInclude = (viewerId: bigint) =>
  ({
    user: { select: USER_CARD_SELECT },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentInclude> }>;

/**
 * Ekran 06 şərhləri. Bir səviyyəli ağac: cavaba cavab verəndə o, kök şərhin
 * altına düşür — mobil ekranda iç-içə sonsuz sütun yaranmasın.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly graph: SocialGraphService,
    private readonly notifications: NotificationsService,
  ) {}

  private shape(c: CommentRow, viewerId: bigint | undefined, postOwnerId: bigint) {
    const isMine = viewerId !== undefined && c.userId === viewerId;
    return {
      publicId: c.publicId,
      body: c.body,
      createdAt: c.createdAt,
      likeCount: c.likeCount,
      liked: c.likes.length > 0,
      isMine,
      // Paylaşım sahibi öz altındakı şərhləri silə bilər
      canDelete: isMine || (viewerId !== undefined && viewerId === postOwnerId),
      author: this.graph.card(c.user),
    };
  }

  async list(postPublicId: string, dto: CommentsQueryDto, viewerId?: bigint) {
    const post = await this.posts.findVisible(postPublicId, viewerId);
    const hidden = await this.graph.hiddenUserIds(viewerId);
    const limit = dto.limit ?? 20;
    const notHidden: Prisma.CommentWhereInput = hidden.length ? { userId: { notIn: hidden } } : {};

    const cursor = dto.cursor
      ? await this.prisma.comment.findFirst({
          where: { publicId: dto.cursor, postId: post.id },
          select: { id: true, createdAt: true },
        })
      : null;

    const rows = await this.prisma.comment.findMany({
      where: {
        postId: post.id,
        parentId: null,
        deletedAt: null,
        ...notHidden,
        ...(cursor
          ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: {
        ...commentInclude(viewerId ?? 0n),
        replies: {
          where: { deletedAt: null, ...notHidden },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: commentInclude(viewerId ?? 0n),
        },
      },
    });

    const page = rows.slice(0, limit);
    return {
      data: page.map((c) => ({
        ...this.shape(c, viewerId, post.userId),
        replies: c.replies.map((r) => this.shape(r, viewerId, post.userId)),
      })),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.publicId ?? null) : null,
      total: post.commentCount,
    };
  }

  async create(userId: bigint, postPublicId: string, dto: CreateCommentDto) {
    const post = await this.posts.findVisible(postPublicId, userId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Şərh boş ola bilməz' });

    const parent = dto.parent
      ? await this.prisma.comment.findFirst({
          where: { publicId: dto.parent, postId: post.id, deletedAt: null },
          select: { id: true, parentId: true, userId: true },
        })
      : null;
    if (dto.parent && !parent) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Cavab verilən şərh tapılmadı' });
    }

    const [comment, updated] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          publicId: ulid(),
          postId: post.id,
          userId,
          parentId: parent ? (parent.parentId ?? parent.id) : null,
          body,
        },
        include: commentInclude(userId),
      }),
      this.prisma.post.update({
        where: { id: post.id },
        data: { commentCount: { increment: 1 } },
        select: { commentCount: true },
      }),
    ]);

    const preview = body.length > 60 ? `${body.slice(0, 57)}…` : body;
    const deepLink = `gezgin://post/${post.publicId}`;
    await this.notifications.notify({
      userId: post.userId,
      actorId: userId,
      type: 'social_comment',
      title: `{actor} şərh yazdı: "${preview}"`,
      targetType: 'post',
      targetId: post.id,
      deepLink,
      imageUrl: this.posts.firstMediaUrl(post),
    });
    if (parent && parent.userId !== post.userId) {
      await this.notifications.notify({
        userId: parent.userId,
        actorId: userId,
        type: 'social_comment',
        title: `{actor} şərhinə cavab yazdı: "${preview}"`,
        targetType: 'comment',
        targetId: parent.id,
        deepLink,
      });
    }

    return { ...this.shape(comment, userId, post.userId), replies: [], commentCount: updated.commentCount };
  }

  async remove(userId: bigint, publicId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, userId: true, parentId: true, postId: true, post: { select: { userId: true } } },
    });
    if (!comment) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Şərh tapılmadı' });
    if (comment.userId !== userId && comment.post.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu şərhi silə bilməzsiniz' });
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      // Kök şərh silinəndə cavabları da gizlənir — sayğac hamısı üçün azalır
      const replies =
        comment.parentId === null
          ? await tx.comment.updateMany({ where: { parentId: comment.id, deletedAt: null }, data: { deletedAt: now } })
          : { count: 0 };
      await tx.comment.update({ where: { id: comment.id }, data: { deletedAt: now } });
      const removed = 1 + replies.count;
      const post = await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: removed } },
        select: { commentCount: true },
      });
      return { removed, commentCount: post.commentCount };
    });

    return { deleted: true, ...result };
  }

  async setLike(userId: bigint, publicId: string, like: boolean) {
    const comment = await this.prisma.comment.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, post: { select: { publicId: true } } },
    });
    if (!comment) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Şərh tapılmadı' });
    await this.posts.findVisible(comment.post.publicId, userId);

    if (like) {
      const { count } = await this.prisma.commentLike.createMany({
        data: [{ commentId: comment.id, userId }],
        skipDuplicates: true,
      });
      if (count) await this.prisma.comment.update({ where: { id: comment.id }, data: { likeCount: { increment: 1 } } });
    } else {
      const { count } = await this.prisma.commentLike.deleteMany({ where: { commentId: comment.id, userId } });
      if (count) await this.prisma.comment.update({ where: { id: comment.id }, data: { likeCount: { decrement: 1 } } });
    }

    const { likeCount } = await this.prisma.comment.findUniqueOrThrow({
      where: { id: comment.id },
      select: { likeCount: true },
    });
    return { liked: like, likeCount };
  }
}
