import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@gezgin/shared';

export const ROLES_KEY = 'roles';
/** Endpointi yalnız göstərilən rollara açır — RolesGuard yoxlayır. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
