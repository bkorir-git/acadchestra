/**
 * @file seed.ts
 * @description Single executable seed entrypoint. Runs:
 *   1. Permissions catalog
 *   2. Curriculum templates
 *   3. Demo tenant + super admin
 *   4. SuperAdmin role for the demo tenant
 *   5. Ensure system roles (Admin, Principal, Finance, Teacher, Student, Parent)
 *      across ALL existing tenants — backfills Finance for legacy tenants.
 *   6. Default backup policy
 *
 * Usage: pnpm exec ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedPermissions } from './seeds/permissions.seed';
import { seedCurriculumTemplates } from './seeds/curriculum-templates.seed';
import {
  ensureSystemRolesForAllTenants,
  ensureSuperAdminRole,
  SYSTEM_ROLES,
} from './seeds/system-roles.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // 1. Permissions
  const perms = await seedPermissions(prisma);
  console.log(`✅ Permissions: ${perms.count} ensured`);

  // 2. Curriculum templates
  await seedCurriculumTemplates(prisma);
  console.log('✅ Curriculum templates seeded');

  // 3. Demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'demo.acadchestra.com' },
    update: {},
    create: {
      name: 'Demo School',
      domain: 'demo.acadchestra.com',
      subdomain: 'demo',
      email: 'admin@demo.acadchestra.com',
      phone: '+1234567890',
      address: '123 Education Street',
      planType: 'PROFESSIONAL',
      maxStudents: 500,
      isOnboarded: true,
      onboardedAt: new Date(),
    },
  });
  console.log(`✅ Tenant: ${tenant.name}`);

  // Tenant settings
  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  // 4. SuperAdmin role for the demo tenant
  await ensureSuperAdminRole(prisma, tenant.id);

  // 5. Ensure system roles (Admin/Principal/Finance/Teacher/Student/Parent)
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name_tenantId: { name: role.name, tenantId: tenant.id } },
      update: {},
      create: { ...role, isSystem: true, tenantId: tenant.id },
    });
  }
  console.log(`✅ System roles: ${SYSTEM_ROLES.length + 1} ensured for demo tenant`);

  // Backfill across all tenants (no-op for fresh DB)
  const ensured = await ensureSystemRolesForAllTenants(prisma);
  console.log(`✅ Backfill across all tenants: checked ${ensured.tenantsChecked}, created ${ensured.rolesCreated}`);

  // 6. Demo SuperAdmin user
  const hashed = await bcrypt.hash('Admin123!', 12);
  const superUser = await prisma.user.upsert({
    where: { email: 'superadmin@demo.acadchestra.com' },
    update: {},
    create: {
      email: 'superadmin@demo.acadchestra.com',
      password: hashed,
      firstName: 'Super',
      lastName: 'Admin',
      isEmailVerified: true,
      tenantId: tenant.id,
    },
  });

  const superRole = await prisma.role.findFirst({
    where: { name: 'SuperAdmin', tenantId: tenant.id },
  });
  if (superRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: superUser.id, roleId: superRole.id } },
      update: {},
      create: { userId: superUser.id, roleId: superRole.id },
    });
  }
  console.log(`✅ Demo SuperAdmin: ${superUser.email}`);

  // 7. Default academic year for the demo
  await prisma.academicYear.upsert({
    where: { name_tenantId: { name: '2024-2025', tenantId: tenant.id } },
    update: {},
    create: {
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isCurrent: true,
      tenantId: tenant.id,
    },
  });

  // 8. Default backup policy (single-row upsert by deterministic id)
  const existingPolicy = await prisma.backupPolicy.findFirst();
  if (!existingPolicy) {
    await prisma.backupPolicy.create({
      data: {
        isEnabled: true,
        scheduleCron: '0 2 * * *',
        retentionKeep: 5,
        includeUploads: true,
        remoteSync: true,
        notes: 'Default policy created by seed',
      },
    });
    console.log('✅ Default backup policy created');
  } else {
    console.log('ℹ️  Backup policy already exists, skipped');
  }

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Demo credentials:');
  console.log('   Email:  superadmin@demo.acadchestra.com');
  console.log('   Pass:   Admin123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
