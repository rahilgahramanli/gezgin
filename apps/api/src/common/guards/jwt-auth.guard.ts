import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ERROR_CODES } from '@gezgin/shared';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Qlobal guard — bütün endpointlər defolt olaraq qorunur,
 * açıq olanlar `@Public()` ilə işarələnir.
 *
 * Açıq endpointlərdə də token varsa, istifadəçi kontekstə yüklənir
 * (isteğe bağlı autentifikasiya). Bu, şəxsiləşdirmə üçün lazımdır:
 * axtarış tarixçəsi, rəydə "faydalı" işarəsi, "saxlanılıb" statusu —
 * hamısı açıq endpointdə, amma daxil olmuş istifadəçi üçün fərqlidir.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) return (await super.canActivate(context)) as boolean;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.headers.authorization) return true;

    try {
      await super.canActivate(context);
    } catch {
      // Açıq endpointdə yanlış və ya vaxtı bitmiş token sorğunu bloklamır —
      // sadəcə anonim kimi davam edir.
    }
    return true;
  }

  handleRequest<T>(err: Error | null, user: T | false, info: { name?: string } | undefined): T {
    if (err || !user) {
      const expired = info?.name === 'TokenExpiredError';
      throw new UnauthorizedException({
        code: expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.UNAUTHORIZED,
        message: expired ? 'Token vaxtı bitib' : 'Bu əməliyyat üçün daxil olmalısınız',
      });
    }
    return user;
  }
}
