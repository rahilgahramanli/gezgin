import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ERROR_CODES, type UserRole } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '../token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { publicId: payload.sub },
      select: { id: true, publicId: true, username: true, role: true, status: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.status !== 'active') {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Hesab tapılmadı və ya aktiv deyil' });
    }

    return {
      id: user.id,
      publicId: user.publicId,
      username: user.username,
      role: user.role as UserRole,
      isGuest: payload.guest === true,
    };
  }
}
