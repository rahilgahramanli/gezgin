import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import { RolesGuard } from './common/guards/roles.guard';
import { MailModule } from './modules/mail/mail.module';
import { StorageModule } from './modules/storage/storage.module';
import { SystemModule } from './modules/system/system.module';
import { AuthModule } from './modules/auth/auth.module';
import { MeModule } from './modules/me/me.module';
import { MediaModule } from './modules/media/media.module';
import { RegionsModule } from './modules/regions/regions.module';
import { PlacesModule } from './modules/places/places.module';
import { SearchModule } from './modules/search/search.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ExperiencesModule } from './modules/experiences/experiences.module';
import { TripsModule } from './modules/trips/trips.module';
import { SavedModule } from './modules/saved/saved.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { OfflineModule } from './modules/offline/offline.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CommunityModule } from './modules/community/community.module';
import { PostsModule } from './modules/posts/posts.module';
import { UsersModule } from './modules/users/users.module';
import { StoriesModule } from './modules/stories/stories.module';
import { ChatModule } from './modules/chat/chat.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 300 },
      { name: 'burst', ttl: 1_000, limit: 20 },
    ]),
    PrismaModule,
    MailModule,
    StorageModule,
    SystemModule,
    AuthModule,
    MeModule,
    MediaModule,
    RegionsModule,
    PlacesModule,
    SearchModule,
    ReviewsModule,
    RoutesModule,
    ExperiencesModule,
    TripsModule,
    SavedModule,
    GamificationModule,
    OfflineModule,
    PaymentsModule,
    BookingsModule,
    BusinessesModule,
    // Sprint 7 — sosial lent
    CommunityModule,
    PostsModule,
    UsersModule,
    StoriesModule,
    ChatModule,
    AdminModule,
  ],
  providers: [
    // Sıra vacibdir: əvvəl limit, sonra autentifikasiya, sonra rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Qlobal pipe/filter/interceptor burada qeydiyyatdan keçir (main.ts-də yox),
    // ki testlər və worker eyni davranışı alsın. Əks halda məsələn
    // BigInt seriallaşdırması yalnız HTTP serverdə işləyər.
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: BigIntInterceptor },
  ],
})
export class AppModule {}
