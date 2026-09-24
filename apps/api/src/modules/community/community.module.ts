import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { ReportsService } from './reports.service';
import { SocialGraphService } from './social-graph.service';

/**
 * Sosial modulların ortaq hissəsi — posts, stories, users, chat, reviews
 * hamısı izləmə/bloklama, bildiriş və şikayətdən istifadə edir.
 * Global-dır ki, modullar bir-birini idxal etmədən istifadə etsin.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [SocialGraphService, NotificationsService, ReportsService, RealtimeService, RealtimeGateway],
  exports: [SocialGraphService, NotificationsService, ReportsService, RealtimeService],
})
export class CommunityModule {}
