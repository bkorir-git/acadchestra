/**
 * @file permissions.seed.ts
 * @description Canonical permission catalog. Idempotent.
 */

import { PrismaClient } from '@prisma/client';

const PERMISSIONS = [
  // Users
  ['users', 'create'], ['users', 'read'], ['users', 'update'], ['users', 'delete'],
  // Students
  ['students', 'create'], ['students', 'read'], ['students', 'update'], ['students', 'delete'],
  // Teachers
  ['teachers', 'create'], ['teachers', 'read'], ['teachers', 'update'], ['teachers', 'delete'],
  // Classes
  ['classes', 'create'], ['classes', 'read'], ['classes', 'update'], ['classes', 'delete'],
  // Academic
  ['academic_years', 'create'], ['academic_years', 'read'], ['academic_years', 'update'], ['academic_years', 'delete'],
  ['terms', 'create'], ['terms', 'read'], ['terms', 'update'], ['terms', 'delete'],
  ['subjects', 'create'], ['subjects', 'read'], ['subjects', 'update'], ['subjects', 'delete'],
  // Curriculum
  ['curriculum', 'create'], ['curriculum', 'read'], ['curriculum', 'update'], ['curriculum', 'delete'],
  // Fees
  ['fees', 'create'], ['fees', 'read'], ['fees', 'update'], ['fees', 'delete'],
  ['fee_payments', 'create'], ['fee_payments', 'read'], ['fee_payments', 'update'], ['fee_payments', 'void'],
  // Attendance
  ['attendance', 'create'], ['attendance', 'read'], ['attendance', 'update'], ['attendance', 'finalize'],
  // Settings / Config
  ['settings', 'read'], ['settings', 'update'],
  ['config', 'read'], ['config', 'update'],
  // System (SuperAdmin only)
  ['system', 'read'], ['system', 'update'],
  ['backups', 'create'], ['backups', 'read'], ['backups', 'restore'],
  ['uploads', 'create'], ['uploads', 'read'], ['uploads', 'delete'],
  ['tenants', 'create'], ['tenants', 'read'], ['tenants', 'update'], ['tenants', 'delete'],
];

export async function seedPermissions(prisma: PrismaClient) {
  let created = 0;
  for (const [resource, action] of PERMISSIONS) {
    const result = await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      update: {},
      create: {
        resource,
        action,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource.replace(/_/g, ' ')}`,
      },
    });
    if (result) created++;
  }
  return { count: created };
}
