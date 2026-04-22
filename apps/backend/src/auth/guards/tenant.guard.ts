import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * TenantGuard
 * -----------
 * Enforces tenant isolation: every authenticated request MUST belong to a tenant,
 * and the tenantId from token is the single source of truth — body/query values
 * are ignored to prevent cross-tenant data leakage.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }
    // Hard-overwrite any user-supplied tenantId
    if (req.body) req.body.tenantId = req.user.tenantId;
    if (req.query) req.query.tenantId = req.user.tenantId;
    return true;
  }
}