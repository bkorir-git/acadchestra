/**
 * @file roles.guard.ts
 * @description Role-based access guard. Reads required roles from the
 *   @Roles() decorator and matches them against the authenticated user's
 *   role list. SuperAdmin bypasses all role checks.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !user.userRoles) {
      throw new ForbiddenException('Access denied');
    }

    const userRoles: string[] = user.userRoles.map((ur: any) => ur.role.name);
    if (userRoles.includes('SuperAdmin')) return true;

    const ok = required.some((r) => userRoles.includes(r));
    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
