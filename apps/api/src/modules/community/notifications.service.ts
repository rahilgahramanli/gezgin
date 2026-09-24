import { Injectable, Logger } from '@nestjs/common';
import type { Notification, NotificationType, Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RealtimeService } from './realtime.service';
import { SocialGraphService, USER_CARD_SELECT, type UserCardRow } from './social-graph.service';
import type { ListNotificationsDto } from './dto/community.dto';

/** Ekran 07 "Sosial" tabı. Qalanları "Sistem"-dir (badge, level, rezervasiya). */
const SOCIAL_TYPES: NotificationType[] = ['social_follow', 'social_like', 'social_comment'];

export interface NotifyInput {
  userId: bigint;
  actorId?: bigint | null;
  type: NotificationType;
  /** `{actor}` aktyorun adı ilə əvəz olunur: "{actor} paylaşımını bəyəndi". */
  title: string;
  body?: string | null;
  targetType?: string | null;
  targetId?: bigint | null;
  deepLink?: string | null;
  imageUrl?: string | null;
  /** Bu müddətdə eyni aktyor + hədəf üçün təkrar bildiriş yaranmır (bəyən → geri al → bəyən). */
  dedupeMinutes?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: SocialGraphService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Bildiriş yaradır və canlı göndərir.
   * Xəta əsas əməliyyatı (bəyənmə, şərh, izləmə) sındırmamalıdır — udulur və loglanır.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.create(input);
    } catch (e) {
      this.logger.warn(`Bildiriş yaradılmadı (${input.type}): ${(e as Error).message}`);
    }
  }

  private async create(input: NotifyInput): Promise<void> {
    const actorId = input.actorId ?? null;
    if (actorId !== null && actorId === input.userId) return;
    if (actorId !== null && (await this.graph.isBlockedBetween(input.userId, actorId))) return;

    if (actorId !== null && input.dedupeMinutes) {
      const duplicate = await this.prisma.notification.findFirst({
        where: {
          userId: input.userId,
          actorId,
          type: input.type,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          createdAt: { gte: new Date(Date.now() - input.dedupeMinutes * 60_000) },
        },
        select: { id: true },
      });
      if (duplicate) return;
    }

    const [actor, recipient] = await Promise.all([
      actorId !== null ? this.prisma.user.findUnique({ where: { id: actorId }, select: USER_CARD_SELECT }) : null,
      this.prisma.user.findUnique({ where: { id: input.userId }, select: { publicId: true } }),
    ]);
    if (!recipient) return;

    const row = await this.prisma.notification.create({
      data: {
        publicId: ulid(),
        userId: input.userId,
        actorId,
        type: input.type,
        titleAz: input.title.replace('{actor}', actor?.fullName.split(' ')[0] ?? 'Kimsə').slice(0, 190),
        bodyAz: input.body ? input.body.slice(0, 500) : null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        deepLink: input.deepLink ?? null,
        imageUrl: input.imageUrl ?? null,
        sentAt: new Date(),
      },
    });

    this.realtime.emitToUser(recipient.publicId, 'notification.new', this.shape(row, actor));
  }

  private shape(n: Notification, actor: UserCardRow | null | undefined) {
    return {
      publicId: n.publicId,
      type: n.type,
      category: SOCIAL_TYPES.includes(n.type) ? ('social' as const) : ('system' as const),
      title: n.titleAz,
      body: n.bodyAz,
      imageUrl: n.imageUrl,
      deepLink: n.deepLink,
      targetType: n.targetType,
      actor: actor ? this.graph.card(actor) : null,
      isRead: n.readAt !== null,
      createdAt: n.createdAt,
    };
  }

  /** Ekran 07. Bildirişlər real vaxtda yarandığı üçün `id` sırası zaman sırasıdır. */
  async list(userId: bigint, dto: ListNotificationsDto) {
    const limit = dto.limit ?? 20;
    const typeFilter: Prisma.NotificationWhereInput =
      dto.tab === 'social'
        ? { type: { in: SOCIAL_TYPES } }
        : dto.tab === 'system'
          ? { type: { notIn: SOCIAL_TYPES } }
          : {};
    const cursor = dto.cursor
      ? await this.prisma.notification.findFirst({ where: { publicId: dto.cursor, userId }, select: { id: true } })
      : null;

    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...typeFilter, ...(cursor ? { id: { lt: cursor.id } } : {}) },
        orderBy: { id: 'desc' },
        take: limit + 1,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const page = rows.slice(0, limit);
    const actorIds = [...new Set(page.map((n) => n.actorId).filter((id): id is bigint => id !== null))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: USER_CARD_SELECT })
      : [];
    const byId = new Map(actors.map((a) => [a.id.toString(), a]));

    return {
      data: page.map((n) => this.shape(n, n.actorId !== null ? byId.get(n.actorId.toString()) : null)),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.publicId ?? null) : null,
      unreadCount,
    };
  }

  async markRead(userId: bigint, publicId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, publicId, readAt: null },
      data: { readAt: new Date() },
    });
    return { unreadCount: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markAllRead(userId: bigint) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { unreadCount: 0 };
  }
}
