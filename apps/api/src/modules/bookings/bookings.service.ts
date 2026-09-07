import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES, PLATFORM_COMMISSION_RATE, EXPERT_PAYOUT_RATE } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { XpService } from '@/modules/gamification/xp.service';
import { PaymentsService } from '@/modules/payments/payments.service';
import { newBookingCode } from '@/common/ulid';
import { EXTRAS, type CancelBookingDto, type CreateBookingDto, type ListBookingsDto, type PayBookingDto, type QuoteDto } from './dto/bookings.dto';

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

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly payments: PaymentsService,
    private readonly xp: XpService,
  ) {}

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
    if (idempotencyKey) {
      const existing = await this.prisma.booking.findUnique({ where: { idempotencyKey } });
      if (existing) return this.detail(existing.publicId, userId);
    }

    const q = await this.computeQuote(dto);

    let startAt: Date;
    if (q.slot) {
      startAt = q.slot.startAt;
      if (q.slot.booked + q.adults + q.children > q.slot.capacity) {
        throw new BadRequestException({
          code: ERROR_CODES.BOOKING_SLOT_TAKEN,
          message: `Bu tarixdə yalnız ${q.slot.capacity - q.slot.booked} yer qalıb`,
        });
      }
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

    const booking = await this.prisma.booking.create({
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
        idempotencyKey: idempotencyKey ?? null,
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
    });

    // Yeri saxlayırıq — ödəniş alınmasa ləğvdə geri qaytarılır
    if (q.slot) {
      await this.prisma.experienceSlot.update({
        where: { id: q.slot.id },
        data: { booked: { increment: q.adults + q.children } },
      });
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
      return this.pay(userId, booking.publicId, { paymentMethod: dto.paymentMethod });
    }
    return this.detail(booking.publicId, userId);
  }

  /** Ekran 18 "Ödə və bron et". */
  async pay(userId: bigint, publicId: string, dto: PayBookingDto) {
    const booking = await this.prisma.booking.findFirst({ where: { publicId, userId } });
    if (!booking) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rezervasiya tapılmadı' });
    if (booking.status === 'confirmed') return this.detail(publicId, userId);
    if (booking.status === 'cancelled') {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Ləğv edilmiş rezervasiya ödənilə bilməz' });
    }

    // Mövcud sessiya varsa təkrar istifadə edirik (3-D Secure qayıdışı)
    let payment = await this.prisma.payment.findFirst({
      where: { bookingId: booking.id, status: { in: ['created', 'requires_action'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      const created = await this.payments.createIntent(booking, dto.paymentMethod, userId);
      payment = created.payment;
    }

    const result = await this.payments.confirm(payment.id, dto.otp);

    if (result.status === 'requires_action') {
      return {
        ...(await this.detail(publicId, userId)),
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

    await this.confirmBooking(booking.id, userId);
    return this.detail(publicId, userId);
  }

  /** Ödəniş uğurlu olanda: status, komissiya və XP. */
  private async confirmBooking(bookingId: bigint, userId: bigint) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { experience: { select: { id: true, expertId: true, titleAz: true } } },
    });
    if (booking.status === 'confirmed') return;

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

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

    await this.xp.award(userId, 'booking_completed', { type: 'booking', id: bookingId, note: booking.code });
  }

  /** Ekran 53 — ləğv və geri qaytarma. */
  async cancel(userId: bigint, publicId: string, dto: CancelBookingDto) {
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

    let refund: { refunded: boolean; amountAzn: number } = { refunded: false, amountAzn: 0 };
    if (paid && refundAmount > 0) {
      const r = await this.payments.refund(paid.publicId, { amountAzn: refundAmount, reason: dto.reason });
      refund = { refunded: true, amountAzn: r.amountAzn };
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: refundAmount > 0 ? 'refunded' : 'cancelled',
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
      },
    });

    // Yeri boşaldırıq
    if (booking.slotId) {
      await this.prisma.experienceSlot.update({
        where: { id: booking.slotId },
        data: { booked: { decrement: booking.adults + booking.children } },
      });
    }

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
    const booking = await this.prisma.booking.findFirst({ where: { publicId }, select: { id: true, userId: true } });
    if (!booking) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Rezervasiya tapılmadı' });
    if (booking.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu rezervasiya sizə aid deyil' });
    }
    return this.shape(booking.id);
  }

  /** Ekran 53 — Rezervasiyalarım. */
  async list(userId: bigint, dto: ListBookingsDto) {
    const now = new Date();
    const filter = dto.filter ?? 'upcoming';

    const where: Prisma.BookingWhereInput =
      filter === 'upcoming'
        ? { userId, status: { in: ['pending', 'awaiting_payment', 'confirmed'] }, startAt: { gte: now } }
        : filter === 'past'
          ? { userId, OR: [{ status: 'completed' }, { startAt: { lt: now }, status: { notIn: ['cancelled', 'refunded'] } }] }
          : { userId, status: { in: ['cancelled', 'refunded'] } };

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.booking.findMany({
      where,
      orderBy: { startAt: filter === 'past' ? 'desc' : 'asc' },
      skip: offset,
      take: limit + 1,
      select: { id: true },
    });

    const counts = await this.prisma.booking.groupBy({ by: ['status'], where: { userId }, _count: true });
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));

    const hasMore = rows.length > limit;
    const data = await Promise.all(rows.slice(0, limit).map((r) => this.shape(r.id)));

    const spent = await this.prisma.booking.aggregate({
      where: { userId, status: { in: ['confirmed', 'completed'] } },
      _sum: { totalAzn: true },
      _count: true,
    });

    return {
      counts: {
        upcoming: (byStatus.confirmed ?? 0) + (byStatus.awaiting_payment ?? 0) + (byStatus.pending ?? 0),
        past: byStatus.completed ?? 0,
        cancelled: (byStatus.cancelled ?? 0) + (byStatus.refunded ?? 0),
      },
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
    const b = await this.detail(publicId, userId);
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
