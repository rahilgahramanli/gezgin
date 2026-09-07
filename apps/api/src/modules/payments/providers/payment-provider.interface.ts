/**
 * Ödəniş provayderi interfeysi.
 *
 * PSP qərarı təxirə salındığı üçün (bax TECH-PLAN §6.1) bütün ödəniş məntiqi
 * bu interfeysin arxasındadır. Real provayder gələndə yalnız yeni bir sinif
 * yazılır — bookings, commissions və qalan kod dəyişmir.
 */

export type PaymentIntentStatus = 'created' | 'requires_action' | 'succeeded' | 'failed';

export interface PaymentIntent {
  providerIntentId: string;
  status: PaymentIntentStatus;
  /** 3-D Secure tələb olunursa müştəri bura yönləndirilir. */
  actionUrl?: string;
  clientSecret?: string;
}

export interface PaymentResult {
  providerPaymentId: string;
  status: 'succeeded' | 'failed' | 'requires_action';
  actionUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  raw?: Record<string, unknown>;
}

export interface RefundResult {
  refundId: string;
  status: 'succeeded' | 'failed';
  amountAzn: number;
  failureMessage?: string;
}

export interface WebhookEvent {
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded' | 'unknown';
  providerIntentId: string | null;
  providerPaymentId: string | null;
  amountAzn: number | null;
  raw: Record<string, unknown>;
}

export interface TokenizedCard {
  providerToken: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName?: string;
}

export interface PaymentProvider {
  readonly code: 'mock' | 'kapital' | 'azericard' | 'pasha';

  createIntent(input: {
    amountAzn: number;
    bookingCode: string;
    methodToken?: string;
    returnUrl?: string;
  }): Promise<PaymentIntent>;

  confirm(intentId: string, payload?: Record<string, unknown>): Promise<PaymentResult>;

  refund(providerPaymentId: string, amountAzn: number): Promise<RefundResult>;

  tokenizeCard(input: {
    number: string;
    expMonth: number;
    expYear: number;
    cvv: string;
    holderName?: string;
  }): Promise<TokenizedCard>;

  handleWebhook(raw: Buffer, signature: string | undefined): Promise<WebhookEvent>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
