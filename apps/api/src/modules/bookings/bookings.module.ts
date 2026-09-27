import { Module } from '@nestjs/common';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingLifecycleService } from './booking-lifecycle.service';

@Module({
  imports: [PaymentsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingLifecycleService],
  // Təcrübə əlçatanlığı (ekran 18) göstərməzdən əvvəl vaxtı bitmiş yerləri boşaldır
  exports: [BookingLifecycleService],
})
export class BookingsModule {}
