import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@gezgin/shared';

/** JWT-dən çıxarılan istifadəçi konteksti — hər qorunan sorğuda mövcuddur. */
export interface AuthUser {
  id: bigint;
  publicId: string;
  username: string;
  role: UserRole;
  isGuest: boolean;
}

export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  const user = req.user;
  if (!user) return undefined;
  return data ? user[data] : user;
});
