import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

export interface TenantsFilter {
  page?: number;
  limit?: number;
  search?: string;
  planType?: string;
  isActive?: boolean;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    const { domain, subdomain } = createTenantDto;

    // Check if domain or subdomain already exists
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { domain },
          { subdomain: subdomain || undefined },
        ],
      },
    });

    if (existingTenant) {
      throw new ConflictException('Domain or subdomain already exists');
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: createTenantDto,
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            classes: true,
          },
        },
      },
    });

    // Create default roles for the tenant
    await this.createDefaultRoles(tenant.id);

    return tenant;
  }

  async findAll(filters: TenantsFilter = {}) {
    const { page = 1, limit = 10, search, planType, isActive } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (planType) {
      where.planType = planType;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
              classes: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            classes: true,
            academicYears: true,
            subjects: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findByDomain(domain: string) {
    return this.prisma.tenant.findUnique({
      where: { domain },
    });
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check domain/subdomain conflicts if updating
    if (updateTenantDto.domain || updateTenantDto.subdomain) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                { domain: updateTenantDto.domain || undefined },
                { subdomain: updateTenantDto.subdomain || undefined },
              ],
            },
          ],
        },
      });

      if (existingTenant) {
        throw new ConflictException('Domain or subdomain already exists');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            classes: true,
          },
        },
      },
    });
  }

  async toggleStatus(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: !tenant.isActive },
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            classes: true,
          },
        },
      },
    });
  }

  private async createDefaultRoles(tenantId: string) {
    const defaultRoles = [
      {
        name: 'SuperAdmin',
        description: 'Full system access',
        isSystem: true,
      },
      {
        name: 'Admin',
        description: 'Administrative access',
        isSystem: true,
      },
      {
        name: 'Principal',
        description: 'Principal access',
        isSystem: true,
      },
      {
        name: 'Teacher',
        description: 'Teacher access',
        isSystem: true,
      },
      {
        name: 'Student',
        description: 'Student access',
        isSystem: true,
      },
      {
        name: 'Parent',
        description: 'Parent access',
        isSystem: true,
      },
    ];

    for (const roleData of defaultRoles) {
      await this.prisma.role.create({
        data: {
          ...roleData,
          tenantId,
        },
      });
    }
  }

  async remove(id: string, adminPassword: string, adminUserId: string) {
  // Verify admin password
  const adminUser = await this.prisma.user.findUnique({
    where: { id: adminUserId },
  });

  if (!adminUser) {
    throw new UnauthorizedException('Admin user not found');
  }

  const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid admin password');
  }

  const tenant = await this.prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          students: true,
          teachers: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new NotFoundException('Tenant not found');
  }

  // Enhanced validation - prevent deletion of tenants with data
  if (tenant._count.users > 1 || tenant._count.students > 0 || tenant._count.teachers > 0) {
    throw new BadRequestException(
      `Cannot delete tenant with existing data. Found: ${tenant._count.users} users, ${tenant._count.students} students, ${tenant._count.teachers} teachers. Please migrate or remove all data first.`
    );
  }

  // Log the deletion attempt
  await this.prisma.auditLog.create({
    data: {
      action: 'DELETE',
      tableName: 'tenants',
      recordId: id,
      oldValues: tenant,
      // newValues: null,
      userId: adminUserId,
      tenantId: id,
    },
  });

  await this.prisma.tenant.delete({
    where: { id },
  });

  return { 
    message: 'Tenant deleted successfully',
    deletedTenant: {
      name: tenant.name,
      domain: tenant.domain,
      deletedAt: new Date().toISOString(),
    }
  };
}

// Enhanced stats with real storage calculation
async getStats(id: string) {
  const tenant = await this.findOne(id);
  
  const [
    totalUsers,
    activeUsers,
    totalStudents,
    totalTeachers,
    totalClasses,
    storageStats,
    feePayments,
    examinations,
  ] = await Promise.all([
    this.prisma.user.count({ where: { tenantId: id } }),
    this.prisma.user.count({ 
      where: { 
        tenantId: id, 
        isActive: true,
        lastLogin: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      } 
    }),
    this.prisma.student.count({ where: { tenantId: id } }),
    this.prisma.teacher.count({ where: { tenantId: id } }),
    this.prisma.class.count({ where: { tenantId: id } }),
    this.calculateStorageUsage(id),
    this.prisma.feePayment.aggregate({
      where: { tenantId: id },
      _sum: { amount: true },
      _count: true,
    }),
    this.prisma.examination.count({ where: { tenantId: id } }),
  ]);

  return {
    tenant,
    stats: {
      totalUsers,
      activeUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      totalExaminations: examinations,
      totalFeePayments: feePayments._count,
      totalRevenue: feePayments._sum.amount || 0,
      storageUsed: storageStats.totalSizeMB,
      storageBreakdown: storageStats.breakdown,
      capacityUsed: Math.round((totalStudents / tenant.maxStudents) * 100),
      utilizationMetrics: {
        classUtilization: totalClasses > 0 ? Math.round((totalStudents / (totalClasses * 40)) * 100) : 0, // Assuming 40 students per class average
        teacherStudentRatio: totalTeachers > 0 ? Math.round(totalStudents / totalTeachers) : 0,
        activeUserPercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
      }
    },
  };
}

private async calculateStorageUsage(tenantId: string) {
  // This is a simplified calculation - in production you'd want more sophisticated storage tracking
  const [
    userCount,
    studentCount,
    teacherCount,
    classCount,
    auditLogCount,
    feeRecordCount,
  ] = await Promise.all([
    this.prisma.user.count({ where: { tenantId } }),
    this.prisma.student.count({ where: { tenantId } }),
    this.prisma.teacher.count({ where: { tenantId } }),
    this.prisma.class.count({ where: { tenantId } }),
    this.prisma.auditLog.count({ where: { tenantId } }),
    this.prisma.feePayment.count({ where: { tenantId } }),
  ]);

  // Estimated storage per record type (in KB)
  const estimatedSizeKB = 
    userCount * 2 +        // 2KB per user
    studentCount * 3 +     // 3KB per student (more data)
    teacherCount * 2.5 +   // 2.5KB per teacher
    classCount * 1 +       // 1KB per class
    auditLogCount * 0.5 +  // 0.5KB per audit log
    feeRecordCount * 1;    // 1KB per fee record

  return {
    totalSizeMB: Math.round(estimatedSizeKB / 1024 * 100) / 100, // Round to 2 decimal places
    breakdown: {
      users: Math.round(userCount * 2 / 1024 * 100) / 100,
      students: Math.round(studentCount * 3 / 1024 * 100) / 100,
      teachers: Math.round(teacherCount * 2.5 / 1024 * 100) / 100,
      classes: Math.round(classCount * 1 / 1024 * 100) / 100,
      auditLogs: Math.round(auditLogCount * 0.5 / 1024 * 100) / 100,
      feeRecords: Math.round(feeRecordCount * 1 / 1024 * 100) / 100,
    }
  };
}
}