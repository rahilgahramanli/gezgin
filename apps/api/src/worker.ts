import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Fon işləri prosesi (BullMQ). Sprint 5-də XP və badge queue-ları,
 * Sprint 7-də feed fan-out, Sprint 9-da push burada işləyəcək.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('Worker');
  logger.log('GEZGIN worker işə düşdü — hələlik registrasiya olunmuş queue yoxdur');
  app.enableShutdownHooks();
}

void bootstrap();
