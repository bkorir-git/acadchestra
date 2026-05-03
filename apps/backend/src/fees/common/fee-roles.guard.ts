/**
 * @file fee-roles.guard.ts
 * @description Fine-grained role guard for the Fees module. Tiered access:
 *     MANAGE      — create/update/delete structures, run billing, record payments
 *     REPORT_ONLY — view reports + statements
 *     READ_ONLY   — view structures/student fees/payments (no writes)
 *     VOID        — void payments (Admin/Finance only; not Principal)
 *     LOCK        — apply financial lock (Admin/Finance only)
 *
 *   SuperAdmin always passes all tiers.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type FeeAccessTier =
  | 'MANAGE'
  | 'REPORT_ONLY'
  | 'READ_ONLY'
  | 'VOID'
  | 'LOCK';

export const FEE_ACCESS_KEY = 'fee_access_tier';
export const FeeAccess = (tier: FeeAccessTier) =>
  SetMetadata(FEE_ACCESS_KEY, tier);

const MANAGE_ROLES = ['SuperAdmin', 'Admin', 'Principal', 'Finance'];
const REPORT_ROLES = ['SuperAdmin', 'Admin', 'Principal', 'Finance', 'Teacher'];
const READ_ROLES = ['SuperAdmin', 'Admin', 'Principal', 'Finance', 'Teacher'];
const VOID_ROLES = ['SuperAdmin', 'Admin', 'Finance'];
const LOCK_ROLES = ['SuperAdmin', 'Admin', 'Finance'];

@Injectable()
export class FeeRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const tier = this.reflector.getAllAndOverride<FeeAccessTier>(
      FEE_ACCESS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!tier) return true;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] =
      req.user?.userRoles?.map((r: any) => r?.role?.name).filter(Boolean) ?? [];

    const allowed = this.allowedFor(tier);
    const hit = roles.some((r) => allowed.includes(r));
    if (!hit) {
      throw new ForbiddenException(
        `Access denied: requires one of [${allowed.join(', ')}]`,
      );
    }
    return true;
  }

  private allowedFor(tier: FeeAccessTier): string[] {
    switch (tier) {
      case 'MANAGE':
        return MANAGE_ROLES;
      case 'REPORT_ONLY':
        return REPORT_ROLES;
      case 'READ_ONLY':
        return READ_ROLES;
      case 'VOID':
        return VOID_ROLES;
      case 'LOCK':
        return LOCK_ROLES;
    }
  }
}
