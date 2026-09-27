import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { bakuDayStart } from '@/common/time';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Neçə gün irəliyə slot saxlanılır. */
const HORIZON_DAYS = 30;
/** Hər neçə gündən bir slot açılır. */
const EVERY_DAYS = 2;
const REFRESH_MS = 6 * HOUR;

/**
 * Demo/QA mühiti üçün təcrübə tarixləri.
 *
 * Tarixləri Local Expert öz panelindən açmalıdır, amma expert paneli hələ
 * yoxdur (Sprint 8–9) — slotsuz təcrübəni tətbiqdə bron etmək mümkün deyil.
 * `DEMO_SLOTS=true` olanda hər dərc olunmuş təcrübə üçün növbəti 30 gündə
 * iki gündən bir slot saxlanılır (Bakı vaxtı 10:00, gecə turları 19:00).
 * Mövcud slotlara toxunulmur — iş idempotentdir. Real expert paneli
 * gələndə bayraq söndürülür.
 */
@Injectable()
export class DemoSlotsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoSlotsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.DEMO_SLOTS !== 'true' || process.env.NODE_ENV === 'test') return;
    void this.ensure();
    this.timer = setInterval(() => void this.ensure(), REFRESH_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async ensure(): Promise<number> {
    try {
      const experiences = await this.prisma.experience.findMany({
        where: { status: 'published', deletedAt: null },
        select: { id: true, slug: true, maxGroup: true },
      });
      const today = bakuDayStart();
      let created = 0;

      for (const e of experiences) {
        // Bakı vaxtı ilə: gündüz turları 10:00, gecə turları 19:00
        const bakuHour = /gece|axsam|night/.test(e.slug) ? 19 : 10;
        const wanted: Date[] = [];
        for (let d = 1; d <= HORIZON_DAYS; d += EVERY_DAYS) {
          wanted.push(new Date(today.getTime() + d * DAY + bakuHour * HOUR));
        }
        const existing = await this.prisma.experienceSlot.findMany({
          where: { experienceId: e.id, startAt: { in: wanted } },
          select: { startAt: true },
        });
        const have = new Set(existing.map((s) => s.startAt.getTime()));
        const missing = wanted.filter((w) => !have.has(w.getTime()));
        if (!missing.length) continue;

        await this.prisma.experienceSlot.createMany({
          data: missing.map((startAt) => ({ experienceId: e.id, startAt, capacity: e.maxGroup })),
        });
        created += missing.length;
      }
      if (created) this.logger.log(`Demo slotlar: ${created} yeni tarix açıldı`);
      return created;
    } catch (err) {
      this.logger.warn(`Demo slotlar yaradılmadı: ${(err as Error).message}`);
      return 0;
    }
  }
}
