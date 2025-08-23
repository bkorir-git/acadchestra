import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'demo.acadchestra.com' },
    update: {},
    create: {
      name: 'Demo School',
      domain: 'demo.acadchestra.com',
      subdomain: 'demo',
      email: 'admin@demo.acadchestra.com',
      phone: '+1234567890',
      address: '123 Education Street, Learning City',
      planType: 'PROFESSIONAL',
      maxStudents: 500,
    },
  });

  console.log('✅ Created demo tenant:', tenant.name);

  // Create default permissions
  const permissions = [
    { resource: 'users', action: 'create', description: 'Create users' },
    { resource: 'users', action: 'read', description: 'Read users' },
    { resource: 'users', action: 'update', description: 'Update users' },
    { resource: 'users', action: 'delete', description: 'Delete users' },
    { resource: 'students', action: 'create', description: 'Create students' },
    { resource: 'students', action: 'read', description: 'Read students' },
    { resource: 'students', action: 'update', description: 'Update students' },
    { resource: 'students', action: 'delete', description: 'Delete students' },
    { resource: 'teachers', action: 'create', description: 'Create teachers' },
    { resource: 'teachers', action: 'read', description: 'Read teachers' },
    { resource: 'teachers', action: 'update', description: 'Update teachers' },
    { resource: 'teachers', action: 'delete', description: 'Delete teachers' },
    { resource: 'classes', action: 'create', description: 'Create classes' },
    { resource: 'classes', action: 'read', description: 'Read classes' },
    { resource: 'classes', action: 'update', description: 'Update classes' },
    { resource: 'classes', action: 'delete', description: 'Delete classes' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {},
      create: permission,
    });
  }

  console.log('✅ Created default permissions');

  // Create default roles
  const roles = [
    {
      name: 'SuperAdmin',
      description: 'Full system access',
      isSystem: true,
      tenantId: tenant.id,
    },
    {
      name: 'Admin',
      description: 'Administrative access',
      isSystem: true,
      tenantId: tenant.id,
    },
    {
      name: 'Principal',
      description: 'Principal access',
      isSystem: true,
      tenantId: tenant.id,
    },
    {
      name: 'Teacher',
      description: 'Teacher access',
      isSystem: true,
      tenantId: tenant.id,
    },
    {
      name: 'Student',
      description: 'Student access',
      isSystem: true,
      tenantId: tenant.id,
    },
    {
      name: 'Parent',
      description: 'Parent access',
      isSystem: true,
      tenantId: tenant.id,
    },
  ];

  for (const roleData of roles) {
    await prisma.role.upsert({
      where: {
        name_tenantId: {
          name: roleData.name,
          tenantId: roleData.tenantId,
        },
      },
      update: {},
      create: roleData,
    });
  }

  console.log('✅ Created default roles');

  // Create demo super admin user
  const hashedPassword = await bcrypt.hash('Admin123!', 12);
  
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@demo.acadchestra.com' },
    update: {},
    create: {
      email: 'superadmin@demo.acadchestra.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      isEmailVerified: true,
      tenantId: tenant.id,
    },
  });

  // Assign SuperAdmin role
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'SuperAdmin', tenantId: tenant.id },
  });

  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdminUser.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      },
    });
  }

  console.log('✅ Created demo super admin user');

  // Create academic year
  const academicYear = await prisma.academicYear.upsert({
    where: {
      name_tenantId: {
        name: '2024-2025',
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isCurrent: true,
      tenantId: tenant.id,
    },
  });

  console.log('✅ Created academic year:', academicYear.name);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('Email: superadmin@demo.acadchestra.com');
  console.log('Password: Admin123!');
  console.log('Tenant: demo.acadchestra.com');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });