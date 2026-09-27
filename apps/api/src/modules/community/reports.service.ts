import { BadRequestException, Injectable } from '@nestjs/common';
import type { ReportTargetType } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Şikayət moderasiya növbəsinə düşür (admin panel — Sprint 10).
   * Açıq şikayət varkən eyni obyekt təkrar şikayət olunmur — növbə şişməsin.
   */
  async report(
    reporterId: bigint,
    target: { type: ReportTargetType; id: bigint; ownerId: bigint | null },
    // Səbəb siyahısı hədəfə görə fərqlənir (paylaşım/məkan) — yoxlama DTO-dadır
    dto: { reason: string; details?: string },
  ) {
    if (target.ownerId === reporterId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Öz kontentinizi şikayət edə bilməzsiniz',
      });
    }

    const open = await this.prisma.report.findFirst({
      where: { reporterId, targetType: target.type, targetId: target.id, status: { in: ['open', 'reviewing'] } },
      select: { publicId: true },
    });
    if (open) return { reported: true, publicId: open.publicId, duplicate: true };

    const row = await this.prisma.report.create({
      data: {
        publicId: ulid(),
        reporterId,
        targetType: target.type,
        targetId: target.id,
        reportedUserId: target.ownerId,
        reason: dto.reason,
        details: dto.details ?? null,
      },
    });
    return { reported: true, publicId: row.publicId, duplicate: false };
  }
}
