/**
 * @file request-actor.type.ts
 * @module common/types
 * @description The shape of `req.user` after the JwtAuthGuard. Centralized so
 *   every service uses the same contract instead of `any` everywhere.
 */

export interface RequestActor {
  id: string;
  tenantId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  userRoles?: Array<{ role?: { name?: string | null } | null }>;
}
