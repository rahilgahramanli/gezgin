import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Auth guard-ı keçir — açıq endpointlər üçün (Sprint 1-də guard əlavə olunur). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
