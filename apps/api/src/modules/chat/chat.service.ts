import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaService } from '@/modules/media/media.service';
import { RealtimeService } from '@/modules/community/realtime.service';
import { SocialGraphService, USER_CARD_SELECT } from '@/modules/community/social-graph.service';
import type { ListConversationsDto, MessagesQueryDto, SendMessageDto } from './dto/chat.dto';

const FILTER_ROLE: Record<string, UserRole | undefined> = {
  experts: 'local_expert',
  business: 'business',
  travelers: 'gezgin',
};

const messageInclude = {
  sender: { select: { username: true } },
  media: { select: { storageKey: true, width: true, height: true } },
} satisfies Prisma.MessageInclude;

type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

/**
 * Ekran 08–09. Göndərmə HTTP ilə gedir və bazaya yazılır, sonra
 * `RealtimeService` iştirakçıların `user:<id>` otaqlarına çatdırır.
 * Socket qopubsa mesaj itmir — tətbiq yenidən açılanda siyahıdan gəlir.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: SocialGraphService,
    private readonly realtime: RealtimeService,
    private readonly media: MediaService,
  ) {}

  /** İştirakçı deyilsə 404 — söhbətin mövcudluğu açıqlanmır. */
  private async membership(userId: bigint, publicId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { publicId },
      include: {
        participants: { include: { user: { select: { ...USER_CARD_SELECT, lastActiveAt: true } } } },
      },
    });
    const me = conv?.participants.find((p) => p.userId === userId);
    if (!conv || !me) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Söhbət tapılmadı' });
    return { conv, me, others: conv.participants.filter((p) => p.userId !== userId) };
  }

  /** Ekran 08 — son mesaja görə sıralı; boş söhbətlər görünmür. */
  async list(userId: bigint, dto: ListConversationsDto) {
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 30;
    const hidden = await this.graph.hiddenUserIds(userId);
    const role = FILTER_ROLE[dto.filter ?? 'all'];

    const where: Prisma.ConversationParticipantWhereInput = {
      userId,
      leftAt: null,
      conversation: {
        lastMessageAt: { not: null },
        AND: [
          ...(hidden.length ? [{ participants: { none: { userId: { in: hidden } } } }] : []),
          ...(role ? [{ participants: { some: { userId: { not: userId }, user: { role } } } }] : []),
        ],
      },
    };

    const [rows, total, unread] = await Promise.all([
      this.prisma.conversationParticipant.findMany({
        where,
        orderBy: { conversation: { lastMessageAt: 'desc' } },
        skip: offset,
        take: limit + 1,
        include: {
          conversation: {
            include: {
              participants: { where: { userId: { not: userId } }, include: { user: { select: USER_CARD_SELECT } } },
            },
          },
        },
      }),
      this.prisma.conversationParticipant.count({ where }),
      this.prisma.conversationParticipant.aggregate({ where: { userId, leftAt: null }, _sum: { unreadCount: true } }),
    ]);

    const now = new Date();
    return {
      data: rows.slice(0, limit).map((row) => {
        const c = row.conversation;
        const other = c.participants[0];
        return {
          publicId: c.publicId,
          type: c.type,
          other: other ? this.graph.card(other.user) : null,
          title: other?.user.fullName ?? 'GEZGIN Dəstək',
          lastMessage: c.lastMessageAt ? { preview: c.lastMessagePreview, at: c.lastMessageAt } : null,
          unreadCount: row.unreadCount,
          isMuted: row.mutedUntil !== null && row.mutedUntil > now,
        };
      }),
      nextOffset: rows.length > limit ? offset + limit : null,
      total,
      unreadTotal: unread._sum.unreadCount ?? 0,
    };
  }

  /** Mövcud birbaşa söhbəti qaytarır, yoxdursa yaradır — ekran 41 "Mesaj" düyməsi. */
  async open(userId: bigint, username: string) {
    const target = await this.graph.findActive(username, userId);
    if (target.id === userId) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Özünüzlə söhbət aça bilməzsiniz' });
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'direct',
        AND: [{ participants: { some: { userId } } }, { participants: { some: { userId: target.id } } }],
      },
      select: { id: true, publicId: true },
    });

    if (existing) {
      // Əvvəl "sil" edibsə, söhbət yenidən siyahıya qayıdır
      await this.prisma.conversationParticipant.updateMany({
        where: { conversationId: existing.id, userId },
        data: { leftAt: null },
      });
      return this.detail(userId, existing.publicId);
    }

    const conv = await this.prisma.conversation.create({
      data: {
        publicId: ulid(),
        type: 'direct',
        participants: { create: [{ userId }, { userId: target.id }] },
      },
      select: { publicId: true },
    });
    return this.detail(userId, conv.publicId);
  }

  async detail(userId: bigint, publicId: string) {
    const { conv, me, others } = await this.membership(userId, publicId);
    const other = others[0];
    return {
      publicId: conv.publicId,
      type: conv.type,
      other: other
        ? {
            ...this.graph.card(other.user),
            isOnline: await this.realtime.isOnline(other.user.publicId),
            lastActiveAt: other.user.lastActiveAt,
          }
        : null,
      participants: conv.participants.map((p) => this.graph.card(p.user)),
      unreadCount: me.unreadCount,
      isBlocked: other ? await this.graph.isBlockedBetween(userId, other.userId) : false,
      createdAt: conv.createdAt,
    };
  }

  /** Yenidən köhnəyə — mobil siyahını tərsinə (inverted) göstərir. */
  async messages(userId: bigint, publicId: string, dto: MessagesQueryDto) {
    const { conv, others } = await this.membership(userId, publicId);
    const limit = dto.limit ?? 30;
    const before = dto.before
      ? await this.prisma.message.findFirst({
          where: { publicId: dto.before, conversationId: conv.id },
          select: { id: true },
        })
      : null;

    const rows = await this.prisma.message.findMany({
      where: { conversationId: conv.id, deletedAt: null, ...(before ? { id: { lt: before.id } } : {}) },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: messageInclude,
    });

    const page = rows.slice(0, limit);
    const otherReadAt = others[0]?.lastReadAt ?? null;
    return {
      data: page.map((m) => this.shapeMessage(m, userId, otherReadAt)),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.publicId ?? null) : null,
    };
  }

  private shapeMessage(m: MessageRow, viewerId: bigint, otherReadAt: Date | null) {
    const isMine = m.senderId === viewerId;
    return {
      publicId: m.publicId,
      type: m.type,
      body: m.body,
      mediaUrl: this.graph.url(m.media?.storageKey),
      payload: m.payload,
      createdAt: m.createdAt,
      sender: { username: m.sender.username },
      isMine,
      // "Oxundu" işarəsi yalnız öz mesajlarında mənalıdır
      ...(isMine ? { isRead: otherReadAt !== null && otherReadAt >= m.createdAt } : {}),
    };
  }

  async send(user: { id: bigint }, publicId: string, dto: SendMessageDto) {
    const { conv, others } = await this.membership(user.id, publicId);
    for (const o of others) {
      if (await this.graph.isBlockedBetween(user.id, o.userId)) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu istifadəçi ilə yazışma mümkün deyil' });
      }
    }

    const type = dto.type ?? 'text';
    const body = dto.body?.trim() || null;
    let mediaId: bigint | null = null;
    let payload: Prisma.InputJsonObject | undefined;
    let preview: string;

    if (type === 'text') {
      if (!body) throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Mesaj boş ola bilməz' });
      preview = body;
    } else if (type === 'image') {
      if (!dto.media) throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Foto seçilməyib' });
      const [media] = await this.media.ownedReady(user.id, [dto.media]);
      mediaId = media?.id ?? null;
      preview = body ?? '📷 Foto';
    } else {
      if (!dto.target) {
        throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Kart üçün slug lazımdır' });
      }
      payload = type === 'experience_card' ? await this.experienceCard(dto.target) : await this.routeCard(dto.target, user.id);
      preview = `${type === 'experience_card' ? '✨' : '🗺️'} ${String(payload.title)}`;
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: {
          publicId: ulid(),
          conversationId: conv.id,
          senderId: user.id,
          type,
          body,
          mediaId,
          ...(payload ? { payload } : {}),
        },
        include: messageInclude,
      });
      await tx.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: m.createdAt, lastMessagePreview: preview.slice(0, 190) },
      });
      // Qarşı tərəf söhbəti silmişdisə, yeni mesajla geri qayıdır
      await tx.conversationParticipant.updateMany({
        where: { conversationId: conv.id, userId: { not: user.id } },
        data: { unreadCount: { increment: 1 }, leftAt: null },
      });
      await tx.conversationParticipant.updateMany({
        where: { conversationId: conv.id, userId: user.id },
        data: { lastReadAt: m.createdAt, leftAt: null },
      });
      return m;
    });

    // Hər iştirakçı mesajı öz baxış bucağından alır (`isMine`)
    for (const p of conv.participants) {
      this.realtime.emitToUser(p.user.publicId, 'message.new', {
        conversation: conv.publicId,
        message: this.shapeMessage(message, p.userId, null),
      });
      this.realtime.emitToUser(p.user.publicId, 'conversation.updated', {
        conversation: conv.publicId,
        lastMessage: { preview, at: message.createdAt },
        unreadCount: p.userId === user.id ? 0 : p.unreadCount + 1,
      });
    }

    return this.shapeMessage(message, user.id, null);
  }

  /** Ekran 09 — Local Expert-in göndərdiyi təcrübə kartı. Anlıq görüntü saxlanılır. */
  private async experienceCard(slug: string): Promise<Prisma.InputJsonObject> {
    const e = await this.prisma.experience.findFirst({
      where: { slug, deletedAt: null, status: 'published' },
      select: {
        slug: true,
        titleAz: true,
        priceAzn: true,
        durationText: true,
        ratingAvg: true,
        region: { select: { translations: { where: { lang: 'az' }, select: { name: true } } } },
        photos: {
          where: { media: { deletedAt: null } },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { media: { select: { storageKey: true } } },
        },
      },
    });
    if (!e) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${slug}` });
    return {
      kind: 'experience',
      slug: e.slug,
      title: e.titleAz,
      priceAzn: Number(e.priceAzn),
      durationText: e.durationText,
      rating: Number(e.ratingAvg),
      region: e.region.translations[0]?.name ?? null,
      imageUrl: this.graph.url(e.photos[0]?.media.storageKey),
    };
  }

  private async routeCard(slug: string, userId: bigint): Promise<Prisma.InputJsonObject> {
    const r = await this.prisma.route.findFirst({
      where: { slug, deletedAt: null, OR: [{ visibility: { in: ['public', 'official'] } }, { authorId: userId }] },
      select: {
        slug: true,
        days: true,
        ratingAvg: true,
        translations: { where: { lang: 'az' }, select: { title: true } },
        region: { select: { translations: { where: { lang: 'az' }, select: { name: true } } } },
        cover: { select: { storageKey: true } },
        _count: { select: { stops: true } },
      },
    });
    if (!r) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Marşrut tapılmadı: ${slug}` });
    return {
      kind: 'route',
      slug: r.slug,
      title: r.translations[0]?.title ?? r.slug,
      days: r.days,
      stopCount: r._count.stops,
      rating: Number(r.ratingAvg),
      region: r.region.translations[0]?.name ?? null,
      imageUrl: this.graph.url(r.cover?.storageKey),
    };
  }

  async markRead(userId: bigint, publicId: string) {
    const { conv, me, others } = await this.membership(userId, publicId);
    const readAt = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: conv.id, userId } },
      data: { unreadCount: 0, lastReadAt: readAt },
    });
    for (const o of others) {
      this.realtime.emitToUser(o.user.publicId, 'message.read', {
        conversation: conv.publicId,
        username: me.user.username,
        readAt,
      });
    }
    return { unreadCount: 0, readAt };
  }

  /** Yalnız özündən gizlədir — qarşı tərəfdə yazışma qalır. */
  async leave(userId: bigint, publicId: string) {
    const { conv } = await this.membership(userId, publicId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: conv.id, userId } },
      data: { leftAt: new Date(), unreadCount: 0 },
    });
    return { left: true };
  }
}
