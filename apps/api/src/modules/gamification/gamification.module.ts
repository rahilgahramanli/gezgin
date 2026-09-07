import { Global, Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { XpService } from './xp.service';

/** Global — digər modullar (routes, trips, reviews) XP verə bilsin deyə. */
@Global()
@Module({
  controllers: [GamificationController],
  providers: [XpService, GamificationService],
  exports: [XpService],
})
export class GamificationModule {}
