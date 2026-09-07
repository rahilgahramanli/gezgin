import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { ERROR_CODES, type UserRole } from '@gezgin/shared';
import { ulid } from 'ulid';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  guest?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInS: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Refresh tokenlər bazada yalnız hash kimi saxlanılır. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlToSeconds(ttl: string): number {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 900;
    const n = Number(m[1]);
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
  }

  async issue(
    user: { id: bigint; publicId: string; username: string; role: UserRole },
    ctx: { userAgent?: string; ip?: string; family?: string; isGuest?: boolean } = {},
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.publicId,
      username: user.username,
      role: user.role,
      ...(ctx.isGuest ? { guest: true } : {}),
    };

    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';

    const accessToken = await this.jwt.signAsync(payload as object, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlToSeconds(refreshTtl) * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        family: ctx.family ?? ulid(),
        userAgent: ctx.userAgent?.slice(0, 255),
        ip: ctx.ip?.slice(0, 45),
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresInS: this.ttlToSeconds(accessTtl) };
  }

  /**
   * Rotasiya + təkrar istifadə aşkarlaması: işlənmiş token yenidən gəlirsə,
   * bütün ailə ləğv olunur (oğurlanmış token ssenarisi).
   */
  async rotate(refreshToken: string, ctx: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    const tokenHash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, publicId: true, username: true, role: true, status: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Refresh token tanınmadı' });
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: ERROR_CODES.TOKEN_REUSED,
        message: 'Token təkrar istifadə edildi — bütün sessiyalar bağlandı',
      });
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: ERROR_CODES.TOKEN_EXPIRED, message: 'Refresh token vaxtı bitib' });
    }

    if (stored.user.status !== 'active') {
      throw new UnauthorizedException({ code: ERROR_CODES.FORBIDDEN, message: 'Hesab aktiv deyil' });
    }

    const pair = await this.issue(stored.user, { ...ctx, family: stored.family });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return pair;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: bigint): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
