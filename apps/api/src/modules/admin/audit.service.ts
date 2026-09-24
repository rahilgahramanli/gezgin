import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface AuditEntry {
  actorId: bigint;
  /** `report.resolve`, `user.suspend`, `content.delete` — nöqtə ilə ayrılmış sabit ad. */
  action: string;
  targetType?: string;
  targetId?: bigint;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

/**
 * Admin əməliyyatlarının izi. Panelin hər dəyişikliyi buradan keçir —
 * "kim, nə vaxt, nəyi, hansı vəziyyətdən hansına" sualının yeganə cavabı budur.
 *
 * Yazma sorğunu bloklamır: audit sətri yazıla bilməsə, əməliyyat geri qaytarılmır,
 * çünki moderasiya qərarının özü audit sətrindən vacibdir. Uğursuzluq log-a düşür.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          before: entry.before,
          after: entry.after,
          ip: entry.ip?.slice(0, 45) ?? null,
          userAgent: entry.userAgent?.slice(0, 255) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Audit yazılmadı (${entry.action}): ${(error as Error).message}`);
    }
  }
}
