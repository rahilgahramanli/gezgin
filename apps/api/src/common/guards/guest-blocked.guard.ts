import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@gezgin/shared';
import type { AuthUser } from '../decorators/current-user.decorator';

/**
 * Qonaq istifadəçilər (ekran 01 "Qonaq kimi davam et") baxa bilər,
 * amma paylaşım, rezervasiya, rəy kimi əməliyyatlar qadağandır.
 */
@Injectable()
export class GuestBlockedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (user?.isGuest) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Bu əməliyyat üçün hesab yaratmalısınız',
      });
    }
    return true;
  }
}
