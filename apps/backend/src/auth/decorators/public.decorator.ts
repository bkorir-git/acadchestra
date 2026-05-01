/**
 * @file public.decorator.ts
 * @description Marks an endpoint as publicly accessible (skips JwtAuthGuard).
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
