import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'node:crypto';
import { ERROR_CODES } from '@gezgin/shared';
import type { OtpPurpose } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MailService } from '@/modules/mail/mail.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private hash(code: string, target: string): string {
    return createHash('sha256').update(`${target}:${code}`).digest('hex');
  }

  /** Dev mühitində kod cavabda qaytarılır — Mailhog-a baxmadan test etmək üçün. */
  private get isDev(): boolean {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  async send(target: string, purpose: OtpPurpose, userId?: bigint): Promise<{ sent: true; devCode?: string }> {
    const recent = await this.prisma.otpCode.count({
      where: { target, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= 5) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMITED, message: 'Saatda 5-dən çox kod göndərilə bilməz' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Köhnə istifadə edilməmiş kodları ləğv et
    await this.prisma.otpCode.updateMany({
      where: { target, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = randomInt(100000, 1000000).toString();
    const ttlMin = this.config.get<number>('OTP_TTL_MINUTES') ?? 10;

    await this.prisma.otpCode.create({
      data: {
        userId: userId ?? null,
        target,
        channel: target.includes('@') ? 'email' : 'sms',
        purpose,
        codeHash: this.hash(code, target),
        expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
      },
    });

    if (target.includes('@')) await this.mail.sendOtp(target, code, purpose);

    return { sent: true, ...(this.isDev ? { devCode: code } : {}) };
  }

  async verify(target: string, code: string, purpose: OtpPurpose): Promise<{ userId: bigint | null }> {
    const record = await this.prisma.otpCode.findFirst({
      where: { target, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException({ code: ERROR_CODES.OTP_INVALID, message: 'Kod tapılmadı və ya artıq istifadə olunub' });
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException({ code: ERROR_CODES.OTP_EXPIRED, message: 'Kodun vaxtı bitib' });
    }

    const maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS') ?? 5;
    if (record.attempts >= maxAttempts) {
      throw new HttpException(
        { code: ERROR_CODES.OTP_TOO_MANY_ATTEMPTS, message: 'Çox sayda yanlış cəhd — yeni kod istəyin' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (record.codeHash !== this.hash(code, target)) {
      await this.prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException({ code: ERROR_CODES.OTP_INVALID, message: 'Kod yanlışdır' });
    }

    await this.prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return { userId: record.userId };
  }
}
