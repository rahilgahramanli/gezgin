import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/payment-provider.interface';
import type { AddPaymentMethodDto, RefundDto } from './dto/payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

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

  /** Rezervasiya üçün ödəniş sessiyası açır. */
  async createIntent(
    booking: { id: bigint; code: string; totalAzn: Prisma.Decimal },
    methodPublicId: string | null,
    userId: bigint,
  ) {
    const method = methodPublicId
      ? await this.prisma.paymentMethod.findFirst({ where: { publicId: methodPublicId, userId, deletedAt: null } })
      : null;
    if (methodPublicId && !method) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Ödəniş üsulu tapılmadı' });
    }

    const amount = Number(booking.totalAzn);
    const intent = await this.provider.createIntent({
      amountAzn: amount,
      bookingCode: booking.code,
      methodToken: method?.providerToken,
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
        methodId: method?.id ?? null,
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
      include: { booking: true },
    });
    if (!payment) return { received: true, handled: false };

    if (event.type === 'payment.succeeded' && payment.status !== 'succeeded') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          providerPaymentId: event.providerPaymentId,
          paidAt: new Date(),
          rawPayload: event.raw as Prisma.InputJsonValue,
        },
      });
      if (payment.bookingId) {
        await this.prisma.booking.updateMany({
          where: { id: payment.bookingId, status: { in: ['pending', 'awaiting_payment'] } },
          data: { status: 'confirmed', confirmedAt: new Date() },
        });
      }
    } else if (event.type === 'payment.failed') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    }

    return { received: true, handled: true, type: event.type };
  }
}
