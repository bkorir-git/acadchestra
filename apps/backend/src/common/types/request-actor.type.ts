/**
 * @file request-actor.type.ts
 * @description Shape of `req.user` after JwtAuthGuard.
 */

export interface RequestActor {
  id: string;
  tenantId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  userRoles?: Array<{ role?: { name?: string | null } | null }>;
}

export function isSuperAdmin(actor: RequestActor): boolean {
  return !!actor.userRoles?.some((r) => r?.role?.name === 'SuperAdmin');
}

export function actorDisplayName(a: RequestActor): string {
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'System';
}
