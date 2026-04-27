/**
 * @file system-roles.seed.ts
 * @description Canonical list of system tenant roles. Includes Finance.
 *   Used by both the global seed (for the demo tenant) and an "ensure"
 *   loop that backfills missing roles across all existing tenants.
 */

import { PrismaClient } from '@prisma/client';

export const SYSTEM_ROLES = [
  { name: 'Admin',     description: 'School administrator — full access' },
  { name: 'Principal', description: 'Principal access' },
  { name: 'Finance',   description: 'Financial operator — full fee management access' },
  { name: 'Teacher',   description: 'Teacher access' },
  { name: 'Student',   description: 'Student portal access' },
  { name: 'Parent',    description: 'Parent portal access' },
] as const;

/**
 * Ensures every active tenant has every system role. Safe to run repeatedly.
 */
export async function ensureSystemRolesForAllTenants(prisma: PrismaClient) {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  let created = 0;
  for (const t of tenants) {
    for (const role of SYSTEM_ROLES) {
      const existing = await prisma.role.findFirst({
        where: { tenantId: t.id, name: role.name },
      });
      if (!existing) {
        await prisma.role.create({
          data: {
            name: role.name,
            description: role.description,
            isSystem: true,
            tenantId: t.id,
          },
        });
        created++;
      }
    }
  }
  return { tenantsChecked: tenants.length, rolesCreated: created };
}

/**
 * Creates SuperAdmin role for a specific tenant (the demo).
 */
export async function ensureSuperAdminRole(prisma: PrismaClient, tenantId: string) {
  const existing = await prisma.role.findFirst({
    where: { name: 'SuperAdmin', tenantId },
  });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      name: 'SuperAdmin',
      description: 'Platform-wide administrator',
      isSystem: true,
      tenantId,
    },
  });
}
