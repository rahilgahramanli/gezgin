import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@gezgin/shared';
import type {
  PaymentIntent, PaymentProvider, PaymentResult, RefundResult, TokenizedCard, WebhookEvent,
} from './payment-provider.interface';

/**
 * Real PSP gələnə qədər işlədilən provayder.
 *
 * Kart nömrəsinə görə davranış seçir — mobil tərəf bütün halları
 * kredensiallar olmadan sınaya bilsin:
 *
 *   4111 1111 1111 1111 → uğurlu
 *   4000 0000 0000 0002 → rədd edildi (kifayət qədər vəsait yoxdur)
 *   4000 0000 0000 3220 → 3-D Secure tələb edir
 *   4000 0000 0000 0069 → müddəti bitmiş kart
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly code = 'mock' as const;
  private readonly logger = new Logger(MockPaymentProvider.name);

  /** Intent → kart davranışı. Yaddaşdadır, çünki mock prosesdən kənara çıxmır. */
  private readonly intents = new Map<string, { amountAzn: number; behaviour: string; bookingCode: string }>();

  private behaviourFor(token?: string): string {
    if (!token) return 'success';
    if (token.includes('decline')) return 'decline';
    if (token.includes('3ds')) return 'requires_action';
    if (token.includes('expired')) return 'expired';
    return 'success';
  }

  async createIntent(input: {
    amountAzn: number;
    bookingCode: string;
    methodToken?: string;
    returnUrl?: string;
  }): Promise<PaymentIntent> {
    const id = `mock_pi_${randomUUID()}`;
    const behaviour = this.behaviourFor(input.methodToken);
    this.intents.set(id, { amountAzn: input.amountAzn, behaviour, bookingCode: input.bookingCode });

    this.logger.warn(
      `MOCK ödəniş: ${input.amountAzn} AZN · ${input.bookingCode} · davranış=${behaviour} — production-da PAYMENT_PROVIDER dəyişdirilməlidir`,
    );

    return {
      providerIntentId: id,
      status: behaviour === 'requires_action' ? 'requires_action' : 'created',
      ...(behaviour === 'requires_action'
        ? { actionUrl: `${input.returnUrl ?? 'gezgin://payment'}?mock3ds=1&intent=${id}` }
        : {}),
      clientSecret: `${id}_secret`,
    };
  }

  async confirm(intentId: string, payload?: Record<string, unknown>): Promise<PaymentResult> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new BadRequestException({ code: ERROR_CODES.PAYMENT_FAILED, message: 'Ödəniş sessiyası tapılmadı' });
    }

    // 3-D Secure axını: müştəri qayıdanda `otp` göndərir
    if (intent.behaviour === 'requires_action' && payload?.otp !== '123456') {
      return {
        providerPaymentId: '',
        status: 'requires_action',
        actionUrl: `gezgin://payment?mock3ds=1&intent=${intentId}`,
      };
    }

    if (intent.behaviour === 'decline') {
      return {
        providerPaymentId: `mock_pay_${randomUUID()}`,
        status: 'failed',
        failureCode: 'insufficient_funds',
        failureMessage: 'Kartda kifayət qədər vəsait yoxdur',
      };
    }
    if (intent.behaviour === 'expired') {
      return {
        providerPaymentId: `mock_pay_${randomUUID()}`,
        status: 'failed',
        failureCode: 'expired_card',
        failureMessage: 'Kartın müddəti bitib',
      };
    }

    this.intents.delete(intentId);
    return {
      providerPaymentId: `mock_pay_${randomUUID()}`,
      status: 'succeeded',
      raw: { amountAzn: intent.amountAzn, bookingCode: intent.bookingCode, mock: true },
    };
  }

  async refund(providerPaymentId: string, amountAzn: number): Promise<RefundResult> {
    return { refundId: `mock_re_${randomUUID()}`, status: 'succeeded', amountAzn };
  }

  async tokenizeCard(input: {
    number: string;
    expMonth: number;
    expYear: number;
    cvv: string;
    holderName?: string;
  }): Promise<TokenizedCard> {
    const digits = input.number.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(digits)) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Kart nömrəsi yanlışdır' });
    }

    const behaviour =
      digits === '4000000000000002' ? 'decline'
      : digits === '4000000000003220' ? '3ds'
      : digits === '4000000000000069' ? 'expired'
      : 'success';

    const brand = digits.startsWith('4') ? 'visa' : digits.startsWith('5') ? 'mastercard' : 'card';

    return {
      // PAN heç vaxt saxlanılmır — yalnız token
      providerToken: `mock_tok_${behaviour}_${digits.slice(-4)}`,
      brand,
      last4: digits.slice(-4),
      expMonth: input.expMonth,
      expYear: input.expYear,
      holderName: input.holderName,
    };
  }

  async handleWebhook(raw: Buffer, signature: string | undefined): Promise<WebhookEvent> {
    // Mock rejimdə imza sadə HMAC-dır — real provayderdə öz alqoritmi olacaq
    const expected = createHmac('sha256', 'mock-webhook-secret').update(raw).digest('hex');
    if (signature && signature !== expected) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Webhook imzası yanlışdır' });
    }

    const body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    const type = String(body.type ?? '');
    return {
      type:
        type === 'payment.succeeded' || type === 'payment.failed' || type === 'payment.refunded'
          ? type
          : 'unknown',
      providerIntentId: (body.intentId as string) ?? null,
      providerPaymentId: (body.paymentId as string) ?? null,
      amountAzn: body.amountAzn === undefined ? null : Number(body.amountAzn),
      raw: body,
    };
  }
}
