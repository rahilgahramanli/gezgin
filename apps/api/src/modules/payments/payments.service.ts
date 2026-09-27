import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/payment-provider.interface';
import type { AddPaymentMethodDto, RefundDto } from './dto/payments.dto';

/** Uğurlu ödənişdən sonra rezervasiyanı təsdiqləyən funksiya — bax `registerBookingConfirmer`. */
export type BookingConfirmer = (payment: { id: bigint; publicId: string; bookingId: bigint }) => Promise<unknown>;

const OPEN_STATUSES = ['created', 'requires_action'] as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private bookingConfirmer?: BookingConfirmer;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Webhook-la gələn uğurlu ödəniş də `POST /bookings/:id/pay` ilə eyni yoldan
   * təsdiqlənməlidir (komissiya, XP, bookingCount). BookingsModule bu modulu idxal
   * edir, əksinə yox — dairəvi asılılıq yaranmasın deyə təsdiq funksiyası
   * BookingsService işə düşəndə buradan qeydiyyatdan keçir.
   */
  registerBookingConfirmer(fn: BookingConfirmer): void {
    this.bookingConfirmer = fn;
  }

  get providerCode() {
    return this.provider.code;
  }

  // ─────────────────── ödəniş üsulları ───────────────────

  async methods(userId: bigint) {
    const rows = await this.prisma.paymentMethod.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((m) => ({
      publicId: m.publicId,
      brand: m.brand,
      last4: m.last4,
      expMonth: m.expMonth,
      expYear: m.expYear,
      holderName: m.holderName,
      isDefault: m.isDefault,
      isExpired: m.expYear !== null && m.expMonth !== null
        ? new Date(m.expYear, m.expMonth, 0) < new Date()
        : false,
    }));
  }

  async addMethod(userId: bigint, dto: AddPaymentMethodDto) {
    const card = await this.provider.tokenizeCard({
      number: dto.number,
      expMonth: dto.expMonth,
      expYear: dto.expYear,
      cvv: dto.cvv,
      holderName: dto.holderName,
    });

    const existing = await this.prisma.paymentMethod.findFirst({
      where: { userId, providerToken: card.providerToken, deletedAt: null },
    });
    if (existing) {
      return { publicId: existing.publicId, brand: existing.brand, last4: existing.last4, isDefault: existing.isDefault };
    }

    const count = await this.prisma.paymentMethod.count({ where: { userId, deletedAt: null } });
    const isDefault = dto.isDefault ?? count === 0;

    if (isDefault) {
      await this.prisma.paymentMethod.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const created = await this.prisma.paymentMethod.create({
      data: {
        publicId: ulid(),
        userId,
        provider: this.provider.code,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        holderName: card.holderName ?? null,
        providerToken: card.providerToken,
        isDefault,
      },
    });

    return { publicId: created.publicId, brand: created.brand, last4: created.last4, isDefault: created.isDefault };
  }

  /**
   * Əsas kartı dəyişir. Əvvəl yalnız ilk kart avtomatik əsas olurdu —
   * istifadəçinin bunu sonradan dəyişmək yolu yox idi (ekran "Ödəniş üsullarım").
   */
  async setDefault(userId: bigint, id: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { publicId: id, userId, deletedAt: null },
    });
    if (!method) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Ödəniş üsulu tapılmadı' });

    await this.prisma.$transaction([
      this.prisma.paymentMethod.updateMany({
        where: { userId, isDefault: true, id: { not: method.id } },
        data: { isDefault: false },
      }),
      this.prisma.paymentMethod.update({ where: { id: method.id }, data: { isDefault: true } }),
    ]);
    return this.methods(userId);
  }

  async removeMethod(userId: bigint, id: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { publicId: id, userId, deletedAt: null },
    });
    if (!method) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Ödəniş üsulu tapılmadı' });

    await this.prisma.paymentMethod.update({ where: { id: method.id }, data: { deletedAt: new Date(), isDefault: false } });

    // Defolt silinibsə, qalanlardan biri defolt olur
    if (method.isDefault) {
      const next = await this.prisma.paymentMethod.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (next) await this.prisma.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
  }

  // ─────────────────── ödəniş axını ───────────────────

  /**
   * Rezervasiya üçün ödəniş sessiyası. Açıq sessiya eyni kartladırsa təkrar
   * istifadə olunur (3-D Secure qayıdışı); başqa kartladırsa köhnəsi ləğv edilir
   * və yenisi açılır — əks halda yeni kart seçilsə də köhnə kartdan çəkilirdi.
   */
  async openIntent(
    booking: { id: bigint; code: string; totalAzn: Prisma.Decimal },
    methodPublicId: string,
    userId: bigint,
  ) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { publicId: methodPublicId, userId, deletedAt: null },
    });
    if (!method) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Ödəniş üsulu tapılmadı' });

    const open = await this.prisma.payment.findFirst({
      where: { bookingId: booking.id, status: { in: [...OPEN_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });
    if (open && open.methodId === method.id) return open;

    await this.voidOpenIntents(booking.id, 'method_changed', 'Başqa ödəniş üsulu seçildi');
    return (await this.createIntent(booking, method)).payment;
  }

  /**
   * Rezervasiyanın açıq (ödənilməmiş) sessiyalarını bağlayır — kart dəyişəndə,
   * ödəniş vaxtı bitəndə və ya rezervasiya ləğv olunanda. Sxemdə `cancelled`
   * statusu yoxdur, səbəb `failureCode`-da saxlanılır.
   */
  async voidOpenIntents(bookingId: bigint, failureCode: string, failureMessage: string): Promise<number> {
    const open = await this.prisma.payment.findMany({
      where: { bookingId, status: { in: [...OPEN_STATUSES] } },
      select: { id: true, providerIntentId: true },
    });
    let voided = 0;
    for (const p of open) {
      const { count } = await this.prisma.payment.updateMany({
        where: { id: p.id, status: { in: [...OPEN_STATUSES] } },
        data: { status: 'failed', failureCode, failureMessage },
      });
      if (!count) continue;
      voided += 1;
      if (p.providerIntentId) {
        await this.provider.cancelIntent(p.providerIntentId).catch((e: unknown) =>
          this.logger.warn(`Sessiya provayderdə ləğv olunmadı: ${p.providerIntentId} · ${String(e)}`),
        );
      }
    }
    return voided;
  }

  /** Yeni ödəniş sessiyası açır. */
  private async createIntent(
    booking: { id: bigint; code: string; totalAzn: Prisma.Decimal },
    method: { id: bigint; providerToken: string },
  ) {
    const amount = Number(booking.totalAzn);
    const intent = await this.provider.createIntent({
      amountAzn: amount,
      bookingCode: booking.code,
      methodToken: method.providerToken,
      returnUrl: 'gezgin://payment/return',
    });

    const payment = await this.prisma.payment.create({
      data: {
        publicId: ulid(),
        bookingId: booking.id,
        provider: this.provider.code,
        status: intent.status === 'requires_action' ? 'requires_action' : 'created',
        amountAzn: booking.totalAzn,
        providerIntentId: intent.providerIntentId,
        methodId: method.id,
      },
    });

    return { payment, intent };
  }

  /** Ödənişi təsdiqləyir. 3-D Secure lazımdırsa `requires_action` qaytarır. */
  async confirm(paymentId: bigint, otp?: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === 'succeeded') {
      return { status: 'succeeded' as const, payment };
    }
    if (!payment.providerIntentId) {
      throw new BadRequestException({ code: ERROR_CODES.PAYMENT_FAILED, message: 'Ödəniş sessiyası yoxdur' });
    }

    const result = await this.provider.confirm(payment.providerIntentId, otp ? { otp } : undefined);

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status === 'succeeded' ? 'succeeded' : result.status === 'failed' ? 'failed' : 'requires_action',
        providerPaymentId: result.providerPaymentId || null,
        failureCode: result.failureCode ?? null,
        failureMessage: result.failureMessage ?? null,
        paidAt: result.status === 'succeeded' ? new Date() : null,
        rawPayload: (result.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return { status: result.status, payment: updated, actionUrl: result.actionUrl };
  }

  async refund(paymentPublicId: string, dto: RefundDto) {
    const payment = await this.prisma.payment.findFirst({ where: { publicId: paymentPublicId } });
    if (!payment) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Ödəniş tapılmadı' });
    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
      throw new BadRequestException({
        code: ERROR_CODES.CONFLICT,
        message: 'Yalnız uğurlu ödənişlər geri qaytarıla bilər',
      });
    }

    const alreadyRefunded = Number(payment.refundedAzn);
    const maxRefund = Number(payment.amountAzn) - alreadyRefunded;
    const amount = dto.amountAzn ?? maxRefund;

    if (amount <= 0 || amount > maxRefund) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Geri qaytarıla bilən maksimum məbləğ: ${maxRefund} AZN`,
      });
    }

    const result = await this.provider.refund(payment.providerPaymentId ?? '', amount);
    if (result.status !== 'succeeded') {
      throw new BadRequestException({
        code: ERROR_CODES.PAYMENT_FAILED,
        message: result.failureMessage ?? 'Geri qaytarma alınmadı',
      });
    }

    const totalRefunded = alreadyRefunded + amount;
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAzn: new Prisma.Decimal(totalRefunded),
        status: totalRefunded >= Number(payment.amountAzn) ? 'refunded' : 'partially_refunded',
        refundedAt: new Date(),
      },
    });

    this.logger.log(`Geri qaytarma: ${amount} AZN · ${payment.publicId} · ${dto.reason ?? 'səbəb göstərilməyib'}`);
    return {
      refunded: true,
      amountAzn: amount,
      totalRefundedAzn: totalRefunded,
      status: updated.status,
    };
  }

  /** Provayder bildirişi — ödənişin son statusu buradan da gələ bilər. */
  async handleWebhook(raw: Buffer, signature: string | undefined) {
    const event = await this.provider.handleWebhook(raw, signature);
    if (event.type === 'unknown' || !event.providerIntentId) {
      return { received: true, handled: false };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerIntentId: event.providerIntentId },
    });
    if (!payment) return { received: true, handled: false };

    if (event.type === 'payment.succeeded') {
      // Şərtli yeniləmə — geri qaytarılmış ödəniş yenidən "uğurlu" olmur
      const { count } = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: [...OPEN_STATUSES, 'failed'] } },
        data: {
          status: 'succeeded',
          providerPaymentId: event.providerPaymentId,
          failureCode: null,
          failureMessage: null,
          paidAt: new Date(),
          rawPayload: event.raw as Prisma.InputJsonValue,
        },
      });
      // Təsdiq idempotentdir (təkrar bildiriş 'already' qaytarır). Əvvəlki cəhd yarımçıq
      // qalıbsa (məs. xəta ilə), provayderin təkrar göndərişi rezervasiyanı yenə təsdiqləyir.
      const succeeded = count > 0 || payment.status === 'succeeded';
      if (succeeded && payment.bookingId) {
        if (this.bookingConfirmer) {
          await this.bookingConfirmer({ id: payment.id, publicId: payment.publicId, bookingId: payment.bookingId });
        } else {
          this.logger.error(`Rezervasiya təsdiqləyicisi qeydiyyatda deyil — ${payment.publicId} təsdiqlənmədi`);
        }
      }
    } else if (event.type === 'payment.failed') {
      // Gecikmiş "failed" bildirişi artıq uğurlu ödənişi pozmamalıdır
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: [...OPEN_STATUSES] } },
        data: { status: 'failed' },
      });
    }

    return { received: true, handled: true, type: event.type };
  }
}
