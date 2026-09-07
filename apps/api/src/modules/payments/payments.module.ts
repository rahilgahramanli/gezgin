import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

/**
 * PAYMENT_PROVIDER=mock (defolt) → MockPaymentProvider.
 * Real PSP gələndə burada yeni sinif seçilir — qalan kod dəyişmir.
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, MockPaymentProvider],
      useFactory: (config: ConfigService, mock: MockPaymentProvider) => {
        const code = config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
        if (code !== 'mock') {
          throw new Error(
            `PAYMENT_PROVIDER=${code} üçün provayder hələ yazılmayıb. ` +
              'Bax: TECH-PLAN.md §6.1 — real PSP qoşulanda bu fabrikə əlavə edilməlidir.',
          );
        }
        return mock;
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
