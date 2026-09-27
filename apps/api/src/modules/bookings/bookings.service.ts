import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { Prisma, type BookingStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { ERROR_CODES, PLATFORM_COMMISSION_RATE, EXPERT_PAYOUT_RATE } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { XpService } from '@/modules/gamification/xp.service';
import { PaymentsService } from '@/modules/payments/payments.service';
import { newBookingCode } from '@/common/ulid';
import { EXTRAS, type CancelBookingDto, type CreateBookingDto, type ListBookingsDto, type PayBookingDto, type QuoteDto } from './dto/bookings.dto';
import { ACTIVE_STATUSES, BookingLifecycleService, PAYABLE_STATUSES } from './booking-lifecycle.service';

/** Ləğv siyasəti — ekran 53. Başlanğıca qalan saata görə geri qaytarma faizi. */
const CANCELLATION_TIERS = [
  { hoursBefore: 48, refundRate: 1.0, label: '48 saatdan çox qalıb — tam geri qaytarma' },
  { hoursBefore: 24, refundRate: 0.5, label: '24–48 saat qalıb — 50% geri qaytarma' },
  { hoursBefore: 0, refundRate: 0, label: '24 saatdan az qalıb — geri qaytarma yoxdur' },
];

export interface PriceLine {
  code: string;
  label: string;
  quantity: number;
  unitAzn: number;
  totalAzn: number;
}

/** Ödəniş qəbul etməyən statuslar və səbəbi. */
const NOT_PAYABLE: Partial<Record<BookingStatus, string>> = {
  cancelled: 'Ləğv edilmiş rezervasiya ödənilə bilməz',
  refunded: 'Geri qaytarılmış rezervasiya ödənilə bilməz',
  completed: 'Tamamlanmış rezervasiya ödənilə bilməz',
};

const slotTaken = (left: number) =>
  new BadRequestException({
    code: ERROR_CODES.BOOKING_SLOT_TAKEN,
    message: `Bu tarixdə yalnız ${left} yer qalıb`,
    details: { seatsLeft: left },
  });

@Injectable()
export class BookingsService implements OnModuleInit {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly payments: PaymentsService,
    private readonly xp: XpService,
    private readonly lifecycle: BookingLifecycleService,
  ) {}

  onModuleInit(): void {
    // Webhook-la gələn uğurlu ödəniş də `pay` ilə eyni təsdiq yolundan keçir
    this.payments.registerBookingConfirmer((p) => this.confirmBooking(p.bookingId, p));
  }

  /**
   * `Idempotency-Key` istifadəçiyə aiddir: başqasının eyni açarı onun sifarişini
   * qaytarmamalıdır (əvvəl 403 verirdi). Hash həm də sütunun 64 simvol həddinə
   * uzun açarları sığdırır.
   */
  private scopeKey(userId: bigint, key: string): string {
    return createHash('sha256').update(`${userId}:${key}`).digest('hex');
  }

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /**
   * Ekran 18 və 49 — qiymət bölgüsü.
   * Uşaqlar 50% endirimlə hesablanır; əlavə xidmətlər sabit qiymətlidir.
   */
  private async computeQuote(dto: QuoteDto) {
    const adults = dto.adults ?? 1;
    const children = dto.children ?? 0;
    const lines: PriceLine[] = [];

    let experience: Awaited<ReturnType<typeof this.prisma.experience.findFirst>> = null;
    let pkg: Awaited<ReturnType<typeof this.prisma.businessPackage.findFirst>> = null;
    let slot: Awaited<ReturnType<typeof this.prisma.experienceSlot.findFirst>> = null;
    let unitPrice = 0;
    let title = '';
    let nights = 0;

    if (dto.type === 'experience') {
      experience = await this.prisma.experience.findFirst({
        where: { slug: dto.target, deletedAt: null, status: 'published' },
      });
      if (!experience) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Təcrübə tapılmadı: ${dto.target}` });
      }
      title = experience.titleAz;

      if (dto.slotId) {
        slot = await this.prisma.experienceSlot.findFirst({
          where: { id: BigInt(dto.slotId), experienceId: experience.id, isCancelled: false },
        });
        if (!slot) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Seçilmiş tarix tapılmadı' });
      }

      unitPrice = Number(slot?.priceAzn ?? experience.priceAzn);
      lines.push({ code: 'adult', label: 'Böyük', quantity: adults, unitAzn: unitPrice, totalAzn: this.round(unitPrice * adults) });
      if (children > 0) {
        const childPrice = this.round(unitPrice * 0.5);
        lines.push({ code: 'child', label: 'Uşaq (50% endirim)', quantity: children, unitAzn: childPrice, totalAzn: this.round(childPrice * children) });
      }
    } else {
      pkg = await this.prisma.businessPackage.findFirst({
        where: { publicId: dto.target, isActive: true },
        include: { business: true },
      });
      if (!pkg) {
        pkg = await this.prisma.businessPackage.findFirst({ where: { titleAz: dto.target, isActive: true } });
      }
      if (!pkg) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Paket tapılmadı: ${dto.target}` });
      }
      title = pkg.titleAz;
      nights = pkg.nights;
      unitPrice = Number(pkg.priceAzn);
      // Otel paketi bütün qonaqlar üçün vahid qiymətdir — ekran 49
      lines.push({ code: 'package', label: `${pkg.nights} gecə / ${pkg.days} gün`, quantity: 1, unitAzn: unitPrice, totalAzn: unitPrice });
    }

    for (const code of dto.extras ?? []) {
      const extra = EXTRAS[code];
      if (!extra) {
        throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: `Naməlum əlavə xidmət: ${code}` });
      }
      const qty = dto.type === 'experience' ? adults + children : 1;
      lines.push({ code, label: extra.nameAz, quantity: qty, unitAzn: extra.priceAzn, totalAzn: this.round(extra.priceAzn * qty) });
    }

    const subtotal = this.round(lines.filter((l) => l.code === 'adult' || l.code === 'child' || l.code === 'package').reduce((n, l) => n + l.totalAzn, 0));
    const extrasTotal = this.round(lines.filter((l) => !['adult', 'child', 'package'].includes(l.code)).reduce((n, l) => n + l.totalAzn, 0));
    const serviceFee = 0; // hazırda xidmət haqqı alınmır — ekran 18 "Xidmət haqqı 0 AZN"
    const total = this.round(subtotal + extrasTotal + serviceFee);

    const expertEarns = dto.type === 'experience' ? this.round(subtotal * EXPERT_PAYOUT_RATE) : 0;

    return {
      type: dto.type,
      title,
      experience,
      package: pkg,
      slot,
      adults,
      children,
      nights,
      lines,
      subtotalAzn: subtotal,
      extrasAzn: extrasTotal,
      serviceFeeAzn: serviceFee,
      totalAzn: total,
      commission: dto.type === 'experience'
        ? { expertEarnsAzn: expertEarns, platformFeeAzn: this.round(subtotal - expertEarns), rate: PLATFORM_COMMISSION_RATE }
        : null,
      /** Ekran 17 "Gezgin qazancı" */
      rewards: { bookingXp: 50, experienceXp: 800 },
    };
  }

  async quote(dto: QuoteDto) {
    await this.lifecycle.sweep();
    const q = await this.computeQuote(dto);
    let seatsLeft: number | null = null;
    if (q.slot) seatsLeft = Math.max(0, q.slot.capacity - q.slot.booked);

    return {
      type: q.type,
      title: q.title,
      adults: q.adults,
      children: q.children,
      lines: q.lines,
      subtotalAzn: q.subtotalAzn,
      extrasAzn: q.extrasAzn,
      serviceFeeAzn: q.serviceFeeAzn,
      totalAzn: q.totalAzn,
      // Otel paketində çıxış tarixini ekran 49 bu rəqəmdən hesablayır
      nights: q.nights,
      commission: q.commission,
      rewards: q.rewards,
      slot: q.slot ? { slotId: Number(q.slot.id), startAt: q.slot.startAt, seatsLeft } : null,
      cancellationPolicy: CANCELLATION_TIERS.map((t) => ({ hoursBefore: t.hoursBefore, refundPercent: t.refundRate * 100, label: t.label })),
    };
  }

  /** Ekran 18 → 19. `Idempotency-Key` təkrar sifarişin qarşısını alır. */
  async create(userId: bigint, dto: CreateBookingDto, idempotencyKey?: string) {
    await this.lifecycle.sweep();

    const scopedKey = idempotencyKey ? this.scopeKey(userId, idempotencyKey) : null;
    if (scopedKey) {
      const existing = await this.prisma.booking.findUnique({ where: { idempotencyKey: scopedKey }, select: { publicId: true } });
      if (existing) return this.view(existing.publicId, userId);
    }

    const q = await this.computeQuote(dto);
    const seats = q.adults + q.children;

    let startAt: Date;
    if (q.slot) {
      startAt = q.slot.startAt;
    } else if (dto.startAt) {
      startAt = new Date(dto.startAt);
    } else {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Tarix seçilməlidir (slotId və ya startAt)',
      });
    }
    if (startAt < new Date()) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Keçmiş tarixə rezervasiya edilə bilməz' });
    }

    const endAt = q.nights > 0 ? new Date(startAt.getTime() + q.nights * 86400_000) : null;

    let trip: { id: bigint } | null = null;
    if (dto.trip) {
      trip = await this.prisma.trip.findFirst({
        where: { publicId: dto.trip, userId, deletedAt: null },
        select: { id: true },
      });
      if (!trip) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Səyahət tapılmadı' });
    }

    let booking: { id: bigint; publicId: string };
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        if (q.slot) {
          // Yer atomar tutulur — iki paralel sifariş eyni son yeri ala bilməsin.
          // Ödəniş alınmasa ləğvdə (və ya ödəniş vaxtı bitəndə) geri qaytarılır.
          const taken = await tx.$executeRaw`
            UPDATE experience_slots SET booked = booked + ${seats}
            WHERE id = ${q.slot.id} AND booked + ${seats} <= capacity
          `;
          if (!taken) {
            const fresh = await tx.experienceSlot.findUniqueOrThrow({
              where: { id: q.slot.id },
              select: { capacity: true, booked: true },
            });
            throw slotTaken(Math.max(0, fresh.capacity - fresh.booked));
          }
        } else if (q.experience) {
          // Slotsuz bron: eyni başlanğıca aktiv bronların cəmi qrup həddini keçməməlidir.
          // Təcrübə sətri kilidlənir ki, paralel sifarişlər ardıcıl yoxlansın.
          await tx.$queryRaw`SELECT id FROM experiences WHERE id = ${q.experience.id} FOR UPDATE`;
          const active = await tx.booking.aggregate({
            where: { experienceId: q.experience.id, startAt, status: { in: ACTIVE_STATUSES } },
            _sum: { adults: true, children: true },
          });
          const used = (active._sum.adults ?? 0) + (active._sum.children ?? 0);
          const left = Math.max(0, q.experience.maxGroup - used);
          if (seats > left) throw slotTaken(left);
        }

        return tx.booking.create({
          data: {
            publicId: ulid(),
            code: newBookingCode(),
            userId,
            type: dto.type,
            status: 'awaiting_payment',
            experienceId: q.experience?.id ?? null,
            slotId: q.slot?.id ?? null,
            packageId: q.package?.id ?? null,
            startAt,
            endAt,
            adults: q.adults,
            children: q.children,
            subtotalAzn: new Prisma.Decimal(q.subtotalAzn),
            extrasAzn: new Prisma.Decimal(q.extrasAzn),
            serviceFeeAzn: new Prisma.Decimal(q.serviceFeeAzn),
            totalAzn: new Prisma.Decimal(q.totalAzn),
            idempotencyKey: scopedKey,
            note: dto.note ?? null,
            items: {
              create: q.lines.map((l) => ({
                code: l.code,
                nameAz: l.label,
                quantity: l.quantity,
                unitAzn: new Prisma.Decimal(l.unitAzn),
                totalAzn: new Prisma.Decimal(l.totalAzn),
              })),
            },
          },
          select: { id: true, publicId: true },
        });
      });
    } catch (e) {
      // Eyni açarla paralel təkrar sorğu — birinci yaradılanı qaytarırıq
      if (scopedKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.booking.findUnique({ where: { idempotencyKey: scopedKey }, select: { publicId: true } });
        if (existing) return this.view(existing.publicId, userId);
      }
      throw e;
    }

    if (trip) {
      await this.prisma.tripItem.create({
        data: {
          tripId: trip.id,
          type: dto.type === 'experience' ? 'experience' : 'custom',
          experienceId: q.experience?.id ?? null,
          customTitle: dto.type === 'experience' ? null : q.title,
          bookingId: booking.id,
          sortOrder: 0,
        },
      });
    }

    if (dto.paymentMethod) {
      return this.charge(userId, booking.publicId, { paymentMethod: dto.paymentMethod });
    }
    return this.view(booking.publicId, userId);
  }

  /** Ekran 18 "Ödə və bron et". */
  async pay(userId: bigint, publicId: string, dto: PayBookingDto) {
    await this.lifecycle.sweep();
    return this.charge(userId, publicId, dto);
  }

  /** Ödəniş axını — `create` (kartla birlikdə) və `pay` üçün ortaq. */
  private async charge(userId: bigint, publicId: string, dto: PayBookingDto) {
    const booking = await this.prisma.booking.findFirst({ where: { publicId, userId } });
    if (!booking) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rezervasiya tapılmadı' });
    // Təkrar "Ödə" (məs. şəbəkə kəsilib) ikinci dəfə çəkmir
    if (booking.status === 'confirmed') return this.view(publicId, userId);

    const blocked = NOT_PAYABLE[booking.status];
    if (blocked) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: blocked });
    if (booking.startAt <= new Date()) {
      throw new BadRequestException({
        code: ERROR_CODES.CONFLICT,
        message: 'Başlama vaxtı keçmiş rezervasiya ödənilə bilməz',
      });
    }

    // Açıq sessiya eyni kartladırsa təkrar istifadə olunur (3-D Secure qayıdışı)
    const payment = await this.payments.openIntent(booking, dto.paymentMethod, userId);
    const result = await this.payments.confirm(payment.id, dto.otp);

    if (result.status === 'requires_action') {
      return {
        ...(await this.view(publicId, userId)),
        payment: { status: 'requires_action', actionUrl: result.actionUrl, paymentPublicId: result.payment.publicId },
      };
    }

    if (result.status === 'failed') {
      throw new BadRequestException({
        code: ERROR_CODES.PAYMENT_FAILED,
        message: result.payment.failureMessage ?? 'Ödəniş alınmadı',
        details: { failureCode: result.payment.failureCode },
      });
    }

    const outcome = await this.confirmBooking(booking.id, result.payment);
    if (outcome === 'refunded') {
      throw new BadRequestException({
        code: ERROR_CODES.CONFLICT,
        message: 'Rezervasiya ödəniş zamanı ləğv olundu — məbləğ kartınıza qaytarıldı',
      });
    }
    return this.view(publicId, userId);
  }

  /**
   * Ödəniş uğurlu olanda: status, komissiya, bookingCount və XP.
   * `pay` və provayder webhook-u eyni yoldan keçir. Status şərtli dəyişir —
   * təsdiq yalnız bir dəfə olur; rezervasiya bu arada ləğv olunubsa (məs. ödəniş
   * vaxtı bitib) və ya artıq başqa ödənişlə təsdiqlənibsə, bu ödəniş geri qaytarılır.
   */
  private async confirmBooking(
    bookingId: bigint,
    payment: { id: bigint; publicId: string },
  ): Promise<'confirmed' | 'already' | 'duplicate' | 'refunded'> {
    const claimed = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: { in: PAYABLE_STATUSES } },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { experience: { select: { id: true } } },
    });

    if (!claimed.count) {
      if (booking.status === 'confirmed' || booking.status === 'completed') {
        // Başqa uğurlu ödəniş artıq təsdiqləyibsə (məs. ləğv edilmiş sessiya provayderdə
        // yenə də çəkilib) — ikiqat çəkilməsin
        const other = await this.prisma.payment.count({
          where: { bookingId, id: { not: payment.id }, status: { in: ['succeeded', 'partially_refunded'] } },
        });
        if (!other) return 'already';
        await this.payments.refund(payment.publicId, { reason: 'Təkrar ödəniş' });
        this.logger.warn(`Təkrar ödəniş geri qaytarıldı: ${booking.code} · ${payment.publicId}`);
        return 'duplicate';
      }
      await this.payments.refund(payment.publicId, { reason: 'Rezervasiya ödənişdən əvvəl ləğv olunub' });
      this.logger.warn(`Ləğv olunmuş rezervasiyaya ödəniş gəldi, geri qaytarıldı: ${booking.code}`);
      return 'refunded';
    }

    // Local Expert payı — ekran 12, 17, 36
    if (booking.type === 'experience' && booking.experience) {
      const gross = Number(booking.subtotalAzn);
      const expertAmount = this.round(gross * EXPERT_PAYOUT_RATE);
      await this.prisma.commission.upsert({
        where: { bookingId },
        update: {},
        create: {
          bookingId,
          grossAzn: new Prisma.Decimal(gross),
          rate: new Prisma.Decimal(PLATFORM_COMMISSION_RATE),
          platformAzn: new Prisma.Decimal(this.round(gross - expertAmount)),
          expertAzn: new Prisma.Decimal(expertAmount),
        },
      });
      await this.prisma.experience.update({
        where: { id: booking.experience.id },
        data: { bookingCount: { increment: 1 } },
      });
    }

    await this.xp.award(booking.userId, 'booking_completed', { type: 'booking', id: bookingId, note: booking.code });
    return 'confirmed';
  }

  /** Təsdiqin izləri geri alınır: komissiya, təcrübə sayğacı və +50 XP. */
  private async reverseConfirmation(booking: {
    id: bigint;
    userId: bigint;
    code: string;
    type: string;
    experienceId: bigint | null;
  }) {
    if (booking.type === 'experience' && booking.experienceId) {
      // Artıq ödənişə (payout) düşmüş komissiya silinmir — mühasibat izi qalmalıdır
      const { count } = await this.prisma.commission.deleteMany({ where: { bookingId: booking.id, payoutId: null } });
      if (!count && (await this.prisma.commission.count({ where: { bookingId: booking.id } }))) {
        this.logger.warn(`Ləğv: ${booking.code} komissiyası artıq ödənişə düşüb — əl ilə düzəliş lazımdır`);
      }
      await this.prisma.experience.updateMany({
        where: { id: booking.experienceId, bookingCount: { gt: 0 } },
        data: { bookingCount: { decrement: 1 } },
      });
    }
    await this.xp.revoke(booking.userId, 'booking_completed', {
      type: 'booking',
      id: booking.id,
      note: `${booking.code} ləğv edildi`,
    });
  }

  /** Ekran 53 — ləğv və geri qaytarma. */
  async cancel(userId: bigint, publicId: string, dto: CancelBookingDto) {
    // Bitmiş rezervasiya əvvəlcə `completed` olsun — sonra ləğv edilə bilməz
    await this.lifecycle.sweep();
    const booking = await this.prisma.booking.findFirst({
      where: { publicId, userId },
      include: { payments: { where: { status: { in: ['succeeded', 'partially_refunded'] } }, orderBy: { createdAt: 'desc' } } },
    });
    if (!booking) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rezervasiya tapılmadı' });

    // Yekun statuslar: təkrar ləğv yeri ikinci dəfə boşaldar və statusu geri yazardı.
    // `refunded` də ləğv edilmiş sayılır — geri qaytarma baş verib.
    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Rezervasiya artıq ləğv edilib' });
    }
    if (booking.status === 'completed') {
      throw new BadRequestException({ code: ERROR_CODES.BOOKING_NOT_CANCELLABLE, message: 'Tamamlanmış rezervasiya ləğv edilə bilməz' });
    }

    const hoursLeft = (booking.startAt.getTime() - Date.now()) / 3_600_000;
    const tier = CANCELLATION_TIERS.find((t) => hoursLeft >= t.hoursBefore) ?? CANCELLATION_TIERS[CANCELLATION_TIERS.length - 1];
    const paid = booking.payments[0];
    const refundAmount = paid ? this.round(Number(paid.amountAzn) * tier.refundRate) : 0;

    // Status əvvəlcə şərtli dəyişir — paralel iki ləğv ikiqat geri qaytarma və yer boşaltma etməsin
    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: dto.reason ?? null },
    });
    if (!claimed.count) {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Rezervasiya artıq ləğv edilib' });
    }

    let refund: { refunded: boolean; amountAzn: number } = { refunded: false, amountAzn: 0 };
    if (paid && refundAmount > 0) {
      let r: Awaited<ReturnType<PaymentsService['refund']>>;
      try {
        r = await this.payments.refund(paid.publicId, { amountAzn: refundAmount, reason: dto.reason });
      } catch (e) {
        // Geri qaytarma alınmadısa ləğv də baş tutmur — istifadəçi yenidən cəhd edə bilsin
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: booking.status, cancelledAt: null, cancelReason: null },
        });
        throw e;
      }
      refund = { refunded: true, amountAzn: r.amountAzn };
      await this.prisma.booking.update({ where: { id: booking.id }, data: { status: 'refunded' } });
    }

    // Yarımçıq (3-D Secure) ödəniş sessiyaları bağlanır
    await this.payments.voidOpenIntents(booking.id, 'booking_cancelled', 'Rezervasiya ləğv edildi');

    // Yeri boşaldırıq
    if (booking.slotId) await this.lifecycle.releaseSeats(booking.slotId, booking.adults + booking.children);

    // Təsdiqlənmiş rezervasiya idisə komissiya, sayğac və XP geri alınır
    if (booking.status === 'confirmed') await this.reverseConfirmation(booking);

    this.logger.log(`Rezervasiya ləğv: ${booking.code} · ${tier.label} · ${refundAmount} AZN`);

    return {
      cancelled: true,
      policy: { hoursBefore: Math.round(hoursLeft), refundPercent: tier.refundRate * 100, label: tier.label },
      refund,
    };
  }

  // ─────────────────── oxu ───────────────────

  private async shape(bookingId: bigint) {
    const b = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        commission: true,
        experience: {
          include: {
            expert: { select: { username: true, fullName: true, avatar: { select: { storageKey: true } } } },
            photos: {
              where: { media: { deletedAt: null } },
              include: { media: { select: { storageKey: true } } },
              orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
            },
          },
        },
        package: { include: { business: { include: { cover: { select: { storageKey: true } } } } } },
      },
    });

    const payment = b.payments[0];
    const hoursLeft = (b.startAt.getTime() - Date.now()) / 3_600_000;
    const tier = CANCELLATION_TIERS.find((t) => hoursLeft >= t.hoursBefore) ?? CANCELLATION_TIERS[CANCELLATION_TIERS.length - 1];

    return {
      publicId: b.publicId,
      code: b.code,
      type: b.type,
      status: b.status,
      title: b.experience?.titleAz ?? b.package?.titleAz ?? 'Rezervasiya',
      subtitle: b.experience
        ? `${b.experience.expert.fullName} · Local Expert`
        : b.package
          ? b.package.business.name
          : null,
      imageUrl: this.url(b.experience?.photos[0]?.media.storageKey ?? b.package?.business.cover?.storageKey),
      startAt: b.startAt,
      endAt: b.endAt,
      adults: b.adults,
      children: b.children,
      note: b.note,
      pricing: {
        lines: b.items.map((i) => ({
          code: i.code,
          label: i.nameAz,
          quantity: i.quantity,
          unitAzn: Number(i.unitAzn),
          totalAzn: Number(i.totalAzn),
        })),
        subtotalAzn: Number(b.subtotalAzn),
        extrasAzn: Number(b.extrasAzn),
        serviceFeeAzn: Number(b.serviceFeeAzn),
        totalAzn: Number(b.totalAzn),
      },
      commission: b.commission
        ? {
            expertEarnsAzn: Number(b.commission.expertAzn),
            platformFeeAzn: Number(b.commission.platformAzn),
            rate: Number(b.commission.rate),
          }
        : null,
      payment: payment
        ? {
            publicId: payment.publicId,
            status: payment.status,
            amountAzn: Number(payment.amountAzn),
            refundedAzn: Number(payment.refundedAzn),
            paidAt: payment.paidAt,
            failureMessage: payment.failureMessage,
          }
        : null,
      cancellation: {
        canCancel: ['pending', 'awaiting_payment', 'confirmed'].includes(b.status),
        hoursLeft: Math.round(hoursLeft),
        refundPercent: tier.refundRate * 100,
        label: tier.label,
      },
      confirmedAt: b.confirmedAt,
      cancelledAt: b.cancelledAt,
      createdAt: b.createdAt,
    };
  }

  async detail(publicId: string, userId: bigint) {
    await this.lifecycle.sweep();
    return this.view(publicId, userId);
  }

  /** Daxili oxu — keçid (sweep) olmadan; `create`/`pay` sonunda cavab qurmaq üçün. */
  private async view(publicId: string, userId: bigint) {
    const booking = await this.prisma.booking.findFirst({ where: { publicId }, select: { id: true, userId: true } });
    if (!booking) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rezervasiya tapılmadı' });
    if (booking.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu rezervasiya sizə aid deyil' });
    }
    return this.shape(booking.id);
  }

  /** Ekran 53 — Rezervasiyalarım. */
  async list(userId: bigint, dto: ListBookingsDto) {
    await this.lifecycle.sweep();

    const now = new Date();
    const filter = dto.filter ?? 'upcoming';

    // Tab sayğacları siyahı ilə eyni şərtlərlə sayılır — əks halda "Gələcək (3)" yazıb 2 göstərirdi
    const filters: Record<'upcoming' | 'past' | 'cancelled', Prisma.BookingWhereInput> = {
      upcoming: { userId, status: { in: ACTIVE_STATUSES }, startAt: { gte: now } },
      past: { userId, OR: [{ status: 'completed' }, { startAt: { lt: now }, status: { notIn: ['cancelled', 'refunded'] } }] },
      cancelled: { userId, status: { in: ['cancelled', 'refunded'] } },
    };
    const where = filters[filter];

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.booking.findMany({
      where,
      orderBy: { startAt: filter === 'past' ? 'desc' : 'asc' },
      skip: offset,
      take: limit + 1,
      select: { id: true },
    });

    const [upcoming, past, cancelled] = await Promise.all([
      this.prisma.booking.count({ where: filters.upcoming }),
      this.prisma.booking.count({ where: filters.past }),
      this.prisma.booking.count({ where: filters.cancelled }),
    ]);

    const hasMore = rows.length > limit;
    const data = await Promise.all(rows.slice(0, limit).map((r) => this.shape(r.id)));

    const spent = await this.prisma.booking.aggregate({
      where: { userId, status: { in: ['confirmed', 'completed'] } },
      _sum: { totalAzn: true },
      _count: true,
    });

    return {
      counts: { upcoming, past, cancelled },
      summary: {
        totalSpentAzn: Number(spent._sum.totalAzn ?? 0),
        bookingCount: spent._count,
      },
      data,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Ekran 19, 53 — bilet. */
  async ticket(publicId: string, userId: bigint) {
    const b = await this.view(publicId, userId);
    if (b.status !== 'confirmed' && b.status !== 'completed') {
      throw new BadRequestException({
        code: ERROR_CODES.CONFLICT,
        message: 'Bilet yalnız təsdiqlənmiş rezervasiya üçün mövcuddur',
      });
    }
    return {
      code: b.code,
      /** Mobil tərəf bunu QR kimi göstərir — ekran 19 */
      qrPayload: `GEZGIN:${b.code}:${b.publicId}`,
      title: b.title,
      subtitle: b.subtitle,
      startAt: b.startAt,
      endAt: b.endAt,
      guests: { adults: b.adults, children: b.children },
      totalAzn: b.pricing.totalAzn,
      status: b.status,
      imageUrl: b.imageUrl,
    };
  }
}
