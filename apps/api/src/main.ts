import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap(): Promise<void> {
  // rawBody: webhook imzasını yoxlamaq üçün orijinal bayt axını lazımdır
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false, rawBody: true });
  // nginx arxasında req.ip real müştəri IP-si olsun — yoxsa rate limit bütün istifadəçilər üçün ortaq olur.
  // Yalnız daxili şəbəkədəki proxy-lərə (docker, localhost) etibar edilir; X-Forwarded-For internetdən saxtalaşdırıla bilməz.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  const logger = new Logger('Bootstrap');

  const prefix = process.env.API_PREFIX ?? 'api/v1';
  const port = Number(process.env.API_PORT ?? 3000);

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '*') === '*' ? true : (process.env.CORS_ORIGINS ?? '').split(','),
    credentials: true,
  });

  // Qlobal pipe, filter və interceptor AppModule-da qeydiyyatdadır.

  const swagger = new DocumentBuilder()
    .setTitle('GEZGIN API')
    .setDescription('Regional turizm platforması — mobil və admin API. Sənəd: TECH-PLAN.md')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: 'docs-json',
  });

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`GEZGIN API → http://localhost:${port}/${prefix}`);
  logger.log(`Swagger    → http://localhost:${port}/docs`);
}

void bootstrap();
