/**
 * @file roles.decorator.ts
 * @description Marks a controller / handler with the required role names.
 *   The RolesGuard reads this metadata and matches against the authenticated
 *   user's role list.
 */

import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
