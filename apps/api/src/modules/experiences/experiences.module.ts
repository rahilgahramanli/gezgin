import { Module } from '@nestjs/common';
import { BookingsModule } from '@/modules/bookings/bookings.module';
import { ExperiencesController } from './experiences.controller';
import { ExpertsController } from './experts.controller';
import { ExperiencesService } from './experiences.service';
import { DemoSlotsService } from './demo-slots.service';

@Module({
  imports: [BookingsModule],
  controllers: [ExperiencesController, ExpertsController],
  providers: [ExperiencesService, DemoSlotsService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
