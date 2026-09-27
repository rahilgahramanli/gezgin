import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BookingStatus, ExperienceDuration } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { XpService } from '@/modules/gamification/xp.service';
import { PaymentsService } from '@/modules/payments/payments.service';

/** Ödəniş gözləyən statuslar — vaxtı bitəndə ləğv olunur. */
export const PAYABLE_STATUSES: BookingStatus[] = ['pending', 'awaiting_payment'];
/** Yer tutan statuslar — tutum hesabına daxildir. */
export const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'awaiting_payment', 'confirmed'];

/** Bitmə vaxtı yazılmayıbsa təcrübə müddəti (saat) — ekran 16 müddət çipləri. */
const DURATION_HOURS: Record<ExperienceDuration, number> = {
  two_hours: 2,
  half_day: 4,
  full_day: 10,
  multi_day: 48,
};
/** Müddət bilinmirsə (məs. gecəsiz paket) başlanğıcdan bu qədər sonra bitmiş sayılır. */
const FALLBACK_DURATION_H = 4;
const SWEEP_INTERVAL_MS = 60_000;
/** Bir keçiddə emal olunan maksimum sətir — qalanı növbəti keçiddə. */
const BATCH = 200;

/**
 * Rezervasiyanın həyat dövrü (ekran 53):
 *  • ödənilməmiş rezervasiya `BOOKING_PAYMENT_TTL_MIN` dəqiqədən sonra ləğv olunur,
 *    yeri boşalır, açıq ödəniş sessiyası bağlanır;
 *  • təsdiqlənmiş rezervasiya bitəndən sonra `completed` olur və təcrübə üçün
 *    +800 XP (`experience_completed`) verilir — "Təcrübəçi" badge-i və
 *    /me/stats.experiences buna əsaslanır.
 *
 * Tənbəl işləyir (rezervasiya/əlçatanlıq sorğularının əvvəlində) və əlavə olaraq
 * dəqiqədə bir taymerlə. Keçidlər idempotentdir: hər keçid statusa görə şərtli
 * `updateMany` ilə "tutulur" — paralel sorğular və ya bir neçə API prosesi eyni
 * rezervasiyanı iki dəfə emal etmir, XP bir dəfə verilir.
 */
@Injectable()
export class BookingLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingLifecycleService.name);
  private timer?: NodeJS.Timeout;
  private timerBusy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly xp: XpService,
    private readonly config: ConfigService,
  ) {}

  private get paymentTtlMs(): number {
    return Number(this.config.get('BOOKING_PAYMENT_TTL_MIN') ?? 30) * 60_000;
  }

  onModuleInit(): void {
    // Testlərdə taymer yoxdur — keçidlər sorğularla tənbəl işləyir, jest açıq taymer görmür
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.timerBusy) return;
    this.timerBusy = true;
    try {
      await this.sweep();
    } catch (e) {
      this.logger.error(`Rezervasiya keçidi alınmadı: ${String(e)}`, e instanceof Error ? e.stack : undefined);
    } finally {
      this.timerBusy = false;
    }
  }

  /** Hər iki keçid — vaxtı bitmiş ödənişlər və bitmiş rezervasiyalar. */
  async sweep(now: Date = new Date()): Promise<{ expired: number; completed: number }> {
    const expired = await this.expireUnpaid(now);
    const completed = await this.completeFinished(now);
    return { expired, completed };
  }

  /** Ödəniş vaxtı bitmiş rezervasiyalar ləğv olunur, yer boşalır. */
  async expireUnpaid(now: Date = new Date()): Promise<number> {
    const stale = await this.prisma.booking.findMany({
      where: { status: { in: PAYABLE_STATUSES }, createdAt: { lt: new Date(now.getTime() - this.paymentTtlMs) } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { id: true, code: true, slotId: true, adults: true, children: true },
    });

    let expired = 0;
    for (const b of stale) {
      const { count } = await this.prisma.booking.updateMany({
        where: { id: b.id, status: { in: PAYABLE_STATUSES } },
        data: { status: 'cancelled', cancelledAt: now, cancelReason: 'payment_timeout' },
      });
      // Başqa proses artıq emal edib və ya bu an ödənilib
      if (!count) continue;
      expired += 1;

      if (b.slotId) await this.releaseSeats(b.slotId, b.adults + b.children);
      await this.payments.voidOpenIntents(b.id, 'payment_timeout', 'Ödəniş vaxtı bitdi');
      this.logger.log(`Ödəniş vaxtı bitdi: ${b.code} ləğv edildi`);
    }
    return expired;
  }

  /** Bitmiş təsdiqlənmiş rezervasiyalar tamamlanır; təcrübə üçün XP bir dəfə verilir. */
  async completeFinished(now: Date = new Date()): Promise<number> {
    const started = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        startAt: { lt: now },
        // Otel paketinin çıxış tarixi gələcəkdədirsə hələ bitməyib
        OR: [{ endAt: null }, { endAt: { lte: now } }],
      },
      orderBy: { startAt: 'asc' },
      take: BATCH,
      select: {
        id: true,
        userId: true,
        type: true,
        code: true,
        startAt: true,
        endAt: true,
        slot: { select: { endAt: true } },
        experience: { select: { duration: true } },
      },
    });

    let completed = 0;
    for (const b of started) {
      if (this.endOf(b) > now) continue;

      const { count } = await this.prisma.booking.updateMany({
        where: { id: b.id, status: 'confirmed' },
        data: { status: 'completed', completedAt: now },
      });
      if (!count) continue;
      completed += 1;

      if (b.type === 'experience') {
        try {
          await this.xp.award(b.userId, 'experience_completed', { type: 'booking', id: b.id, note: b.code });
        } catch (e) {
          this.logger.error(`Təcrübə XP-si verilmədi: ${b.code} · ${String(e)}`);
        }
      }
    }
    return completed;
  }

  /** Rezervasiyanın bitmə anı: öz `endAt`-ı, slotun `endAt`-ı, yoxsa başlanğıc + müddət. */
  endOf(b: {
    startAt: Date;
    endAt: Date | null;
    slot: { endAt: Date | null } | null;
    experience: { duration: ExperienceDuration } | null;
  }): Date {
    if (b.endAt) return b.endAt;
    if (b.slot?.endAt) return b.slot.endAt;
    const hours = b.experience ? DURATION_HOURS[b.experience.duration] : FALLBACK_DURATION_H;
    return new Date(b.startAt.getTime() + hours * 3600_000);
  }

  /** Slotdakı yeri boşaldır. `booked` UNSIGNED-dir — sayğac pozulubsa belə 0-da dayanır. */
  async releaseSeats(slotId: bigint, seats: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE experience_slots SET booked = GREATEST(CAST(booked AS SIGNED) - ${seats}, 0) WHERE id = ${slotId}
    `;
  }
}
