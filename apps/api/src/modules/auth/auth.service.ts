import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { ulid } from 'ulid';
import { ERROR_CODES, type UserRole } from '@gezgin/shared';
import type { OtpPurpose } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MailService } from '@/modules/mail/mail.service';
import { TokenService, type TokenPair } from './token.service';
import { OtpService } from './otp.service';
import { SocialVerifier, type SocialIdentity } from './providers/social-verifier';
import type {
  ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, SocialLoginDto,
} from './dto/auth.dto';

export interface SessionResponse extends TokenPair {
  user: {
    publicId: string;
    username: string;
    fullName: string;
    email: string | null;
    role: UserRole;
    level: number;
    xp: number;
    gezginScore: number;
    isGuest: boolean;
    onboardingCompleted: boolean;
  };
}

/** OWASP tövsiyəsi (2024): argon2id, 19 MiB yaddaş, 2 keçid. */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  raw: false,
} satisfies argon2.HashOptions & { raw: false };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly social: SocialVerifier,
    private readonly mail: MailService,
  ) {}

  // ─────────────────── köməkçi ───────────────────

  private async session(
    user: { id: bigint; publicId: string; username: string; fullName: string; email: string | null; role: string; level: number; xp: number; gezginScore: number },
    ctx: { userAgent?: string; ip?: string; isGuest?: boolean },
  ): Promise<SessionResponse> {
    const pair = await this.tokens.issue(
      { id: user.id, publicId: user.publicId, username: user.username, role: user.role as UserRole },
      ctx,
    );
    const interests = await this.prisma.userInterest.count({ where: { userId: user.id } });
    return {
      ...pair,
      user: {
        publicId: user.publicId,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role as UserRole,
        level: user.level,
        xp: user.xp,
        gezginScore: user.gezginScore,
        isGuest: ctx.isGuest === true,
        onboardingCompleted: interests > 0,
      },
    };
  }

  private async uniqueUsername(base: string): Promise<string> {
    const clean = base.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24) || 'gezgin';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? clean : `${clean}${i}`;
      const taken = await this.prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${clean}${Date.now().toString(36)}`;
  }

  // ─────────────────── qeydiyyat / giriş ───────────────────

  async register(dto: RegisterDto, ctx: { userAgent?: string; ip?: string }): Promise<SessionResponse> {
    const [emailTaken, usernameTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { username: dto.username }, select: { id: true } }),
    ]);
    if (emailTaken) throw new ConflictException({ code: ERROR_CODES.EMAIL_TAKEN, message: 'Bu e-mail artıq qeydiyyatdadır' });
    if (usernameTaken) throw new ConflictException({ code: ERROR_CODES.USERNAME_TAKEN, message: 'Bu istifadəçi adı tutulub' });

    const user = await this.prisma.user.create({
      data: {
        publicId: ulid(),
        username: dto.username,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: await argon2.hash(dto.password, ARGON_OPTIONS),
        settings: { create: {} },
        notificationPrefs: { create: {} },
      },
    });

    await this.otp.send(dto.email, 'register', user.id);
    void this.mail.sendWelcome(dto.email, dto.fullName);

    return this.session(user, ctx);
  }

  async login(dto: LoginDto, ctx: { userAgent?: string; ip?: string }): Promise<SessionResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
      },
    });

    // Eyni xəta mesajı — hansı e-mailin qeydiyyatda olduğunu sızdırmırıq
    const invalid = () =>
      new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'E-mail və ya şifrə yanlışdır' });

    if (!user?.passwordHash) {
      // Vaxt fərqi ilə istifadəçinin mövcudluğunu təyin etməyin qarşısını alır
      await argon2.hash('dummy-password-for-timing', ARGON_OPTIONS);
      throw invalid();
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException({ code: ERROR_CODES.FORBIDDEN, message: 'Hesab dayandırılıb' });
    }
    if (!(await argon2.verify(user.passwordHash, dto.password))) throw invalid();

    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return this.session(user, ctx);
  }

  async guest(ctx: { userAgent?: string; ip?: string }): Promise<SessionResponse> {
    const username = await this.uniqueUsername(`qonaq${Date.now().toString(36)}`);
    const user = await this.prisma.user.create({
      data: {
        publicId: ulid(),
        username,
        fullName: 'Qonaq',
        isPublic: false,
        // `isPublic` ilə ayarlar uyğun qalsın — bax MeService.updateSettings
        settings: { create: { profileVisibility: 'followers' } },
        notificationPrefs: { create: {} },
      },
    });
    return this.session(user, { ...ctx, isGuest: true });
  }

  async refresh(refreshToken: string, ctx: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, ctx);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokens.revoke(refreshToken);
    return { success: true };
  }

  // ─────────────────── OTP ───────────────────

  async sendOtp(email: string, purpose: OtpPurpose) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    // password_reset üçün istifadəçinin mövcudluğunu sızdırmırıq
    if (purpose === 'password_reset' && !user) return { sent: true as const };
    return this.otp.send(email, purpose, user?.id);
  }

  async verifyOtp(email: string, code: string, purpose: OtpPurpose): Promise<{ verified: true }> {
    await this.otp.verify(email, code, purpose);
    if (purpose === 'register') {
      await this.prisma.user.updateMany({
        where: { email, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return { verified: true };
  }

  // ─────────────────── şifrə ───────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    return this.sendOtp(dto.email, 'password_reset');
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    await this.otp.verify(dto.email, dto.code, 'password_reset');
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(dto.newPassword, ARGON_OPTIONS) },
    });
    // Şifrə dəyişəndə bütün sessiyalar bağlanır
    await this.tokens.revokeAllForUser(user.id);
    return { success: true };
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Bu hesabda şifrə təyin olunmayıb' });
    }
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Cari şifrə yanlışdır' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword, ARGON_OPTIONS) },
    });
    await this.tokens.revokeAllForUser(userId);
    return { success: true };
  }

  // ─────────────────── sosial giriş ───────────────────

  private async loginWithIdentity(
    identity: SocialIdentity,
    fallbackName: string | undefined,
    ctx: { userAgent?: string; ip?: string },
  ): Promise<SessionResponse> {
    if (!identity.email) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Sosial hesabdan e-mail alınmadı — e-mail ilə qeydiyyatdan keçin',
      });
    }

    let user = await this.prisma.user.findUnique({ where: { email: identity.email } });

    if (!user) {
      const username = await this.uniqueUsername(identity.email.split('@')[0]);
      user = await this.prisma.user.create({
        data: {
          publicId: ulid(),
          username,
          email: identity.email,
          fullName: identity.fullName ?? fallbackName ?? username,
          emailVerifiedAt: identity.emailVerified ? new Date() : null,
          settings: { create: {} },
          notificationPrefs: { create: {} },
        },
      });
      this.logger.log(`Yeni istifadəçi ${identity.provider} ilə: ${username}`);
    } else if (user.deletedAt || user.status !== 'active') {
      throw new UnauthorizedException({ code: ERROR_CODES.FORBIDDEN, message: 'Hesab aktiv deyil' });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return this.session(user, ctx);
  }

  async loginWithGoogle(dto: SocialLoginDto, ctx: { userAgent?: string; ip?: string }): Promise<SessionResponse> {
    return this.loginWithIdentity(await this.social.verifyGoogle(dto.token), dto.fullName, ctx);
  }

  async loginWithApple(dto: SocialLoginDto, ctx: { userAgent?: string; ip?: string }): Promise<SessionResponse> {
    return this.loginWithIdentity(await this.social.verifyApple(dto.token), dto.fullName, ctx);
  }
}
