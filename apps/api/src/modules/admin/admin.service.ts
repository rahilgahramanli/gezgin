import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ReportTargetType, type ReviewTargetType, type UserStatus } from '@prisma/client';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from './audit.service';
import type {
  AuditQueryDto,
  ContentType,
  ReportQueueDto,
  ResolveReportDto,
  SuspendUserDto,
  UserSearchDto,
} from './dto/admin.dto';

/** Sorğunun mənbəyi — audit sətrinə düşür. */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const USER_BRIEF = { publicId: true, username: true, fullName: true } as const;

/** Növbədə bütöv mətn lazım deyil — qərar vermək üçün ilk sətirlər kifayətdir. */
function snippet(text: string | null | undefined, max = 180): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────── panel başlığı ───────────────────

  /**
   * Hədəfi artıq silinmiş açıq şikayətləri bağlayır — müəllif paylaşımını/şərhini
   * silibsə, hesabını ləğv edibsə və ya kontent başqa şikayətlə silinibsə, moderator
   * növbədə "artıq silinib" kontentə vaxt itirməsin. Bütün silmə yollarını (müəllif,
   * hesab silmə, admin) tək yerdə tutmaq üçün növbə oxunmazdan əvvəl işləyir.
   */
  private async closeOrphanedReports(): Promise<number> {
    const tables: Array<[string, string]> = [
      ['post', 'posts'],
      ['comment', 'comments'],
      ['review', 'reviews'],
    ];
    let closed = 0;
    for (const [type, table] of tables) {
      closed += await this.prisma.$executeRawUnsafe(
        `UPDATE reports r JOIN ${table} t ON t.id = r.target_id
         SET r.status = 'resolved', r.resolved_at = NOW(3),
             r.details = TRIM(CONCAT(COALESCE(r.details, ''), '\n[sistem] Kontent artıq silinib'))
         WHERE r.target_type = '${type}' AND r.status IN ('open', 'reviewing') AND t.deleted_at IS NOT NULL`,
      );
    }
    closed += await this.prisma.$executeRawUnsafe(
      `UPDATE reports r JOIN users u ON u.id = r.target_id
       SET r.status = 'resolved', r.resolved_at = NOW(3),
           r.details = TRIM(CONCAT(COALESCE(r.details, ''), '\n[sistem] Hesab silinib'))
       WHERE r.target_type = 'user' AND r.status IN ('open', 'reviewing') AND u.status = 'deleted'`,
    );
    return closed;
  }

  /** Panelin yuxarı zolağı — moderatorun ilk baxışda görməli olduğu rəqəmlər. */
  async stats() {
    await this.closeOrphanedReports();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [openReports, todayReports, users, suspended, newUsers, posts, todayPosts] = await Promise.all([
      this.prisma.report.count({ where: { status: { in: ['open', 'reviewing'] } } }),
      this.prisma.report.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'suspended', deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: dayAgo }, deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { createdAt: { gte: dayAgo }, deletedAt: null } }),
    ]);

    // Ən köhnə açıq şikayət — 24 saatlıq SLA-nın pozulub-pozulmadığını göstərir
    const oldest = await this.prisma.report.findFirst({
      where: { status: { in: ['open', 'reviewing'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    return {
      reports: {
        open: openReports,
        last24h: todayReports,
        oldestOpenAt: oldest?.createdAt ?? null,
        slaBreached: oldest ? Date.now() - oldest.createdAt.getTime() > 24 * 60 * 60 * 1000 : false,
      },
      users: { total: users, suspended, new24h: newUsers },
      posts: { total: posts, new24h: todayPosts },
    };
  }

  // ─────────────────── moderasiya növbəsi ───────────────────

  async reports(dto: ReportQueueDto) {
    await this.closeOrphanedReports();
    const status = dto.status ?? 'open';
    const limit = dto.limit ?? 20;
    const where: Prisma.ReportWhereInput =
      status === 'open' ? { status: { in: ['open', 'reviewing'] } } : { status };

    if (dto.cursor) {
      const c = await this.prisma.report.findUnique({ where: { publicId: dto.cursor }, select: { id: true } });
      if (!c) throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Yanlış cursor' });
      where.id = { lt: c.id };
    }

    const rows = await this.prisma.report.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: {
        reporter: { select: USER_BRIEF },
        reportedUser: { select: { ...USER_BRIEF, status: true } },
      },
    });

    const page = rows.slice(0, limit);
    const targets = await Promise.all(page.map((r) => this.preview(r.targetType, r.targetId)));

    return {
      data: page.map((r, i) => ({
        publicId: r.publicId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        ageHours: Math.round((Date.now() - r.createdAt.getTime()) / 36e5),
        reporter: r.reporter ? { username: r.reporter.username, fullName: r.reporter.fullName } : null,
        reportedUser: r.reportedUser
          ? { username: r.reportedUser.username, fullName: r.reportedUser.fullName, status: r.reportedUser.status }
          : null,
        target: targets[i],
      })),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.publicId ?? null) : null,
    };
  }

  async reportDetail(publicId: string) {
    const report = await this.prisma.report.findUnique({
      where: { publicId },
      include: {
        reporter: { select: USER_BRIEF },
        reportedUser: { select: { ...USER_BRIEF, status: true } },
      },
    });
    if (!report) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Şikayət tapılmadı' });

    const [target, otherOpen] = await Promise.all([
      this.preview(report.targetType, report.targetId, 2000),
      // Eyni obyektə neçə nəfər şikayət edib — təkrar şikayət ciddiliyin göstəricisidir
      this.prisma.report.count({
        where: { targetType: report.targetType, targetId: report.targetId, publicId: { not: publicId } },
      }),
    ]);

    const resolver = report.resolvedById
      ? await this.prisma.user.findUnique({ where: { id: report.resolvedById }, select: { username: true } })
      : null;

    const history = report.reportedUser
      ? await this.prisma.report.count({
          where: { reportedUserId: report.reportedUserId, status: 'resolved' },
        })
      : 0;

    return {
      publicId: report.publicId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      resolvedBy: resolver?.username ?? null,
      reporter: report.reporter ? { username: report.reporter.username, fullName: report.reporter.fullName } : null,
      reportedUser: report.reportedUser
        ? {
            username: report.reportedUser.username,
            fullName: report.reportedUser.fullName,
            status: report.reportedUser.status,
            resolvedReportCount: history,
          }
        : null,
      target,
      otherReportCount: otherOpen,
    };
  }

  /**
   * Növbədəki qərar. Üç seçim var və hər biri audit izinə düşür:
   * `dismiss` — şikayət əsassızdır, `delete_content` — kontent gizlənir,
   * `suspend_user` — kontent gizlənir və müəllif dayandırılır.
   */
  async resolveReport(admin: { id: bigint }, publicId: string, dto: ResolveReportDto, meta: RequestMeta) {
    const report = await this.prisma.report.findUnique({ where: { publicId } });
    if (!report) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Şikayət tapılmadı' });
    if (report.status === 'resolved' || report.status === 'rejected') {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Bu şikayət artıq bağlanıb' });
    }
    // Profil şikayətində silinəcək kontent yoxdur — "həll olundu" heç nə etmədən
    // müəllifin təsdiqlənmiş şikayət sayını artırardı
    if (dto.action === 'delete_content' && report.targetType === 'user') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Profil şikayətində kontent silinmir — hesabı dayandır və ya şikayəti rədd et',
      });
    }

    let contentDeleted = false;
    let userSuspended = false;

    // Dayandırma şərtləri kontentə toxunmadan ƏVVƏL yoxlanılır — 400 halında heç nə dəyişməməlidir
    let suspendTarget: { id: bigint; status: UserStatus } | null = null;
    if (dto.action === 'suspend_user') {
      if (!report.reportedUserId) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Bu şikayətin müəllifi yoxdur — istifadəçi dayandırıla bilməz',
        });
      }
      const target = await this.prisma.user.findUnique({
        where: { id: report.reportedUserId },
        select: { id: true, status: true, role: true },
      });
      if (!target) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });
      if (target.role === 'admin') {
        throw new BadRequestException({ code: ERROR_CODES.FORBIDDEN, message: 'Admin hesabı dayandırıla bilməz' });
      }
      suspendTarget = target;
    }

    if (dto.action !== 'dismiss') {
      contentDeleted = await this.softDeleteTarget(report.targetType, report.targetId);
    }

    if (suspendTarget) {
      // Birbaşa dayandırma ilə eyni yol: sessiyalar bağlanır, audit izi yazılır
      await this.applySuspension(admin, suspendTarget, `report:${report.publicId}${dto.note ? ` · ${dto.note}` : ''}`, meta);
      userSuspended = true;
    }

    const updated = await this.prisma.report.update({
      where: { id: report.id },
      data: {
        status: dto.action === 'dismiss' ? 'rejected' : 'resolved',
        resolvedById: admin.id,
        resolvedAt: new Date(),
        details: dto.note ? `${report.details ?? ''}\n[moderator] ${dto.note}`.trim() : report.details,
      },
      select: { status: true, resolvedAt: true },
    });

    // Eyni obyektə açıq qalan digər şikayətlər də bağlanır — növbə təmiz qalsın
    const alsoClosed = await this.prisma.report.updateMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        status: { in: ['open', 'reviewing'] },
        id: { not: report.id },
      },
      data: { status: updated.status, resolvedById: admin.id, resolvedAt: new Date() },
    });

    await this.audit.record({
      actorId: admin.id,
      action: `report.${dto.action}`,
      targetType: report.targetType,
      targetId: report.targetId,
      before: { status: report.status },
      after: { status: updated.status, contentDeleted, userSuspended, note: dto.note ?? null },
      ...meta,
    });

    return {
      resolved: true,
      status: updated.status,
      contentDeleted,
      userSuspended,
      alsoClosed: alsoClosed.count,
    };
  }

  // ─────────────────── istifadəçilər ───────────────────

  async users(dto: UserSearchDto) {
    const limit = dto.limit ?? 25;
    const offset = dto.offset ?? 0;
    const where: Prisma.UserWhereInput = {
      ...(dto.status ? { status: dto.status } : { deletedAt: null }),
      ...(dto.q
        ? {
            OR: [
              { username: { contains: dto.q } },
              { fullName: { contains: dto.q } },
              { email: { contains: dto.q } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          ...USER_BRIEF,
          email: true,
          role: true,
          status: true,
          level: true,
          createdAt: true,
          _count: { select: { posts: true, reportsReceived: true } },
        },
      }),
    ]);

    return {
      total,
      data: rows.map((u) => ({
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        status: u.status,
        level: u.level,
        createdAt: u.createdAt,
        postCount: u._count.posts,
        reportCount: u._count.reportsReceived,
      })),
    };
  }

  async userDetail(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...USER_BRIEF,
        email: true,
        phone: true,
        role: true,
        status: true,
        level: true,
        xp: true,
        bio: true,
        createdAt: true,
        lastActiveAt: true,
        _count: { select: { posts: true, reviews: true, reportsReceived: true, followers: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });

    const reports = await this.prisma.report.findMany({
      where: { reportedUserId: { not: null }, reportedUser: { username } },
      orderBy: { id: 'desc' },
      take: 10,
      select: { publicId: true, reason: true, status: true, createdAt: true, targetType: true },
    });

    return {
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      role: user.role,
      status: user.status,
      level: user.level,
      xp: user.xp,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      counts: {
        posts: user._count.posts,
        reviews: user._count.reviews,
        followers: user._count.followers,
        reports: user._count.reportsReceived,
      },
      recentReports: reports,
    };
  }

  async suspendUser(admin: { id: bigint }, username: string, dto: SuspendUserDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, status: true, role: true },
    });
    if (!user) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });
    if (user.role === 'admin') {
      throw new BadRequestException({ code: ERROR_CODES.FORBIDDEN, message: 'Admin hesabı dayandırıla bilməz' });
    }
    if (user.status === 'suspended') {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Hesab onsuz da dayandırılıb' });
    }

    await this.applySuspension(admin, user, dto.reason, meta);
    return { suspended: true, username };
  }

  /** Dayandırma — birbaşa (`/admin/users/:u/suspend`) və şikayət qərarı (`suspend_user`) eyni yoldan keçir. */
  private async applySuspension(
    admin: { id: bigint },
    user: { id: bigint; status: UserStatus },
    reason: string | undefined,
    meta: RequestMeta,
  ) {
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'suspended' } });
    // Aktiv sessiyalar da bağlanır — JwtStrategy `status`-u hər sorğuda yoxlayır,
    // amma refresh tokenləri silinməsə, istifadəçi yenidən giriş cəhdi edə bilər
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorId: admin.id,
      action: 'user.suspend',
      targetType: 'user',
      targetId: user.id,
      before: { status: user.status },
      after: { status: 'suspended', reason: reason ?? null },
      ...meta,
    });
  }

  async restoreUser(admin: { id: bigint }, username: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true, status: true } });
    if (!user) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });
    if (user.status === 'active') {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Hesab onsuz da aktivdir' });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
    await this.audit.record({
      actorId: admin.id,
      action: 'user.restore',
      targetType: 'user',
      targetId: user.id,
      before: { status: user.status },
      after: { status: 'active' },
      ...meta,
    });

    return { restored: true, username };
  }

  // ─────────────────── kontent ───────────────────

  async deleteContent(admin: { id: bigint }, type: ContentType, publicId: string, meta: RequestMeta) {
    const target = await this.resolveContent(type, publicId);

    // Hekayə `ReportTargetType`-da yoxdur (24 saatda özü yox olur), ona görə ayrıca silinir
    const removed =
      type === 'story'
        ? (await this.prisma.story.updateMany({ where: { id: target.id, deletedAt: null }, data: { deletedAt: new Date() } })).count > 0
        : await this.softDeleteTarget(type, target.id);
    if (!removed) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Bu kontent artıq silinib' });

    await this.audit.record({
      actorId: admin.id,
      action: 'content.delete',
      targetType: type,
      targetId: target.id,
      before: { publicId, author: target.author },
      after: { deleted: true },
      ...meta,
    });

    return { deleted: true, type, publicId };
  }

  // ─────────────────── audit izi ───────────────────

  async auditTrail(dto: AuditQueryDto) {
    const limit = dto.limit ?? 30;
    const where: Prisma.AuditLogWhereInput = dto.actor ? { actor: { username: dto.actor } } : {};
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: dto.offset ?? 0,
        take: limit,
        include: { actor: { select: { username: true, fullName: true } } },
      }),
    ]);

    return {
      total,
      data: rows.map((r) => ({
        action: r.action,
        actor: r.actor?.username ?? null,
        targetType: r.targetType,
        targetId: r.targetId === null ? null : Number(r.targetId),
        before: r.before,
        after: r.after,
        ip: r.ip,
        createdAt: r.createdAt,
      })),
    };
  }

  // ─────────────────── köməkçilər ───────────────────

  /** Şikayət olunan obyektin qısa təsviri — moderator kontenti görmədən qərar verməməlidir. */
  private async preview(type: ReportTargetType, id: bigint, max = 180) {
    const base = { type, publicId: null as string | null, text: null as string | null, author: null as string | null, createdAt: null as Date | null, deleted: false };

    if (type === 'post') {
      const row = await this.prisma.post.findUnique({
        where: { id },
        select: { publicId: true, body: true, createdAt: true, deletedAt: true, user: { select: { username: true } }, _count: { select: { media: true } } },
      });
      if (!row) return { ...base, missing: true };
      return { ...base, publicId: row.publicId, text: snippet(row.body, max), author: row.user.username, createdAt: row.createdAt, deleted: !!row.deletedAt, mediaCount: row._count.media };
    }

    if (type === 'comment') {
      const row = await this.prisma.comment.findUnique({
        where: { id },
        select: { publicId: true, body: true, createdAt: true, deletedAt: true, user: { select: { username: true } }, post: { select: { publicId: true } } },
      });
      if (!row) return { ...base, missing: true };
      return { ...base, publicId: row.publicId, text: snippet(row.body, max), author: row.user.username, createdAt: row.createdAt, deleted: !!row.deletedAt, postPublicId: row.post.publicId };
    }

    if (type === 'review') {
      const row = await this.prisma.review.findUnique({
        where: { id },
        select: { publicId: true, body: true, rating: true, createdAt: true, deletedAt: true, user: { select: { username: true } } },
      });
      if (!row) return { ...base, missing: true };
      return { ...base, publicId: row.publicId, text: snippet(row.body, max), author: row.user.username, createdAt: row.createdAt, deleted: !!row.deletedAt, rating: row.rating };
    }

    if (type === 'message') {
      const row = await this.prisma.message.findUnique({
        where: { id },
        select: { publicId: true, body: true, createdAt: true, deletedAt: true, sender: { select: { username: true } } },
      });
      if (!row) return { ...base, missing: true };
      return { ...base, publicId: row.publicId, text: snippet(row.body, max), author: row.sender.username, createdAt: row.createdAt, deleted: !!row.deletedAt };
    }

    if (type === 'user') {
      const row = await this.prisma.user.findUnique({
        where: { id },
        select: { publicId: true, username: true, fullName: true, bio: true, createdAt: true, deletedAt: true, status: true },
      });
      if (!row) return { ...base, missing: true };
      return { ...base, publicId: row.publicId, text: snippet(row.bio ?? row.fullName, max), author: row.username, createdAt: row.createdAt, deleted: !!row.deletedAt, status: row.status };
    }

    // place / experience — kontent istifadəçi yaratmır, yalnız istinad üçün
    if (type === 'place') {
      const row = await this.prisma.place.findUnique({
        where: { id },
        select: { slug: true, translations: { where: { lang: 'az' }, select: { name: true } } },
      });
      return row ? { ...base, publicId: row.slug, text: row.translations[0]?.name ?? null } : { ...base, missing: true };
    }

    const row = await this.prisma.experience.findUnique({ where: { id }, select: { slug: true, titleAz: true } });
    return row ? { ...base, publicId: row.slug, text: row.titleAz } : { ...base, missing: true };
  }

  /** Kontenti gizlədir; artıq silinibsə `false` qaytarır (təkrar qərar sayğacları pozmasın). */
  private async softDeleteTarget(type: ReportTargetType, id: bigint): Promise<boolean> {
    const now = new Date();

    if (type === 'post') {
      const { count } = await this.prisma.post.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: now } });
      if (count) await this.prisma.savedItem.deleteMany({ where: { targetType: 'post', targetId: id } });
      return count > 0;
    }

    if (type === 'comment') {
      const comment = await this.prisma.comment.findFirst({ where: { id, deletedAt: null }, select: { postId: true, parentId: true } });
      if (!comment) return false;
      const replies = comment.parentId === null
        ? await this.prisma.comment.updateMany({ where: { parentId: id, deletedAt: null }, data: { deletedAt: now } })
        : { count: 0 };
      await this.prisma.comment.update({ where: { id }, data: { deletedAt: now } });
      await this.prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 + replies.count } } });
      return true;
    }

    if (type === 'review') {
      const review = await this.prisma.review.findFirst({ where: { id, deletedAt: null }, select: { targetType: true, targetId: true } });
      if (!review) return false;
      await this.prisma.review.update({ where: { id }, data: { deletedAt: now } });
      await this.recomputeRating(review.targetType, review.targetId);
      return true;
    }

    if (type === 'message') {
      const { count } = await this.prisma.message.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: now } });
      return count > 0;
    }

    // `user`, `place`, `experience` — kontent silinməsi ilə həll olunmur
    return false;
  }

  /** Rəy silinəndə obyektin reytinqi yenidən hesablanır — `ReviewsService` ilə eyni məntiq. */
  private async recomputeRating(type: ReviewTargetType, targetId: bigint) {
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
    else if (type === 'experience') await this.prisma.experience.update({ where: { id: targetId }, data });
    else if (type === 'route') await this.prisma.route.update({ where: { id: targetId }, data });
    else if (type === 'business') await this.prisma.business.update({ where: { id: targetId }, data });
    // `event` üçün reytinq aqreqatı sxemdə saxlanılmır — hesablamağa ehtiyac yoxdur
  }

  /** Panelin "sil" düyməsi publicId ilə işləyir — daxili id-ni tapır. */
  private async resolveContent(type: ContentType, publicId: string): Promise<{ id: bigint; author: string }> {
    const select = { id: true, user: { select: { username: true } } };
    const row = await {
      post: () => this.prisma.post.findUnique({ where: { publicId }, select }),
      comment: () => this.prisma.comment.findUnique({ where: { publicId }, select }),
      review: () => this.prisma.review.findUnique({ where: { publicId }, select }),
      story: () => this.prisma.story.findUnique({ where: { publicId }, select }),
    }[type]();

    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Kontent tapılmadı' });
    return { id: row.id, author: row.user.username };
  }
}
