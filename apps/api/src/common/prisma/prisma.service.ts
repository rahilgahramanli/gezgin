import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('MySQL bağlantısı quruldu');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Testlərdə bazanı təmizləmək üçün — yalnız test mühitində işləyir. */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAll yalnız test mühitində çağırıla bilər');
    }
    const rows = await this.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'
    `;
    await this.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    for (const { TABLE_NAME } of rows) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }
    await this.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
