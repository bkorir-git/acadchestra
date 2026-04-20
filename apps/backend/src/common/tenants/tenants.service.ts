import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    const {
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPhone,
      adminPassword,
      sendWelcomeEmail,
      ...tenantData
    } = createTenantDto;

    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { domain: tenantData.domain },
          { subdomain: tenantData.subdomain || undefined },
        ],
      },
    });

    if (existingTenant) {
      throw new ConflictException('Domain or subdomain already exists');
    }

    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingAdmin) {
      throw new ConflictException('Admin email already exists');
    }

    const password = adminPassword?.trim() || this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: tenantData,
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

      await this.createDefaultRoles(tx, tenant.id);

      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          phone: adminPhone,
          tenantId: tenant.id,
          isEmailVerified: false,
        },
      });

      const adminRole = await tx.role.findFirst({
        where: { tenantId: tenant.id, name: 'Admin' },
      });

      if (adminRole) {
        await tx.userRole.create({
          data: {
            userId: adminUser.id,
            roleId: adminRole.id,
          },
        });
      }

      return {
        ...tenant,
        bootstrapAdmin: {
          id: adminUser.id,
          email: adminEmail,
          firstName: adminFirstName,
          lastName: adminLastName,
          passwordMode: adminPassword
            ? 'manual_password_set'
            : 'temporary_password_generated',
          temporaryPassword: adminPassword ? undefined : password,
          welcomeEmailRequested: !!sendWelcomeEmail,
          welcomeEmailStatus: sendWelcomeEmail
            ? 'pending_integration'
            : 'not_requested',
        },
      };
    });

    return result;
  }

  async findAll(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      planType?: string;
      isActive?: boolean;
    } = {},
  ) {
    const { page = 1, limit = 10, search, planType, isActive } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (planType) where.planType = planType;
    if (typeof isActive === 'boolean') where.isActive = isActive;

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

    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

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

    const {
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPhone,
      adminPassword,
      sendWelcomeEmail,
      ...tenantData
    } = updateTenantDto as any;

    const updatedTenant = await this.prisma.tenant.update({
      where: { id },
      data: tenantData,
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

    if (
      adminEmail ||
      adminFirstName ||
      adminLastName ||
      adminPhone ||
      adminPassword
    ) {
      const adminRole = await this.prisma.role.findFirst({
        where: { tenantId: id, name: 'Admin' },
      });

      const currentAdmin = adminRole
        ? await this.prisma.user.findFirst({
            where: {
              tenantId: id,
              userRoles: { some: { roleId: adminRole.id } },
            },
          })
        : null;

      if (currentAdmin) {
        const userData: any = {};
        if (adminFirstName) userData.firstName = adminFirstName;
        if (adminLastName) userData.lastName = adminLastName;
        if (adminPhone) userData.phone = adminPhone;
        if (adminEmail && adminEmail !== currentAdmin.email) {
          const existingEmail = await this.prisma.user.findUnique({
            where: { email: adminEmail },
          });
          if (existingEmail && existingEmail.id !== currentAdmin.id) {
            throw new ConflictException('Admin email already exists');
          }
          userData.email = adminEmail;
        }
        if (adminPassword) {
          userData.password = await bcrypt.hash(adminPassword, 12);
        }
        if (Object.keys(userData).length > 0) {
          await this.prisma.user.update({
            where: { id: currentAdmin.id },
            data: userData,
          });
        }
      }
    }

    return {
      ...updatedTenant,
      adminUpdate: {
        welcomeEmailRequested: !!sendWelcomeEmail,
        welcomeEmailStatus: sendWelcomeEmail
          ? 'pending_integration'
          : 'not_requested',
      },
    };
  }

  async toggleStatus(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

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

  async remove(id: string, adminPassword: string, adminUserId: string) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });
    if (!adminUser) throw new UnauthorizedException('Admin user not found');

    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      adminUser.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid admin password');

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

    if (!tenant) throw new NotFoundException('Tenant not found');

    if (
      tenant._count.users > 1 ||
      tenant._count.students > 0 ||
      tenant._count.teachers > 0
    ) {
      throw new BadRequestException(
        `Cannot delete tenant with existing data. Found: ${tenant._count.users} users, ${tenant._count.students} students, ${tenant._count.teachers} teachers.`,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'DELETE',
        tableName: 'tenants',
        recordId: id,
        oldValues: tenant as any,
        userId: adminUserId,
        tenantId: id,
      },
    });

    await this.prisma.tenant.delete({ where: { id } });

    return {
      message: 'Tenant deleted successfully',
      deletedTenant: {
        name: tenant.name,
        domain: tenant.domain,
        deletedAt: new Date().toISOString(),
      },
    };
  }

  async getStats(id: string) {
    const tenant = await this.findOne(id);

    const [
      totalUsers,
      activeUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      totalAcademicYears,
      totalSubjects,
      totalPayments,
      revenue,
      recentStudents,
      recentUsers,
      admissionsByMonth,
      usersByRole,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id } }),
      this.prisma.user.count({ where: { tenantId: id, isActive: true } }),
      this.prisma.student.count({ where: { tenantId: id } }),
      this.prisma.teacher.count({ where: { tenantId: id } }),
      this.prisma.class.count({ where: { tenantId: id } }),
      this.prisma.academicYear.count({ where: { tenantId: id } }),
      this.prisma.subject.count({ where: { tenantId: id } }),
      this.prisma.feePayment.count({ where: { tenantId: id } }),
      this.prisma.feePayment.aggregate({
        where: { tenantId: id, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.student.count({
        where: {
          tenantId: id,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.user.count({
        where: {
          tenantId: id,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.student.findMany({
        where: { tenantId: id },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { tenantId: id },
        select: {
          userRoles: {
            select: {
              role: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const capacityUsed = Math.round(
      (totalStudents / Math.max(tenant.maxStudents, 1)) * 100,
    );

    const monthlyMap = new Map<string, number>();
    for (const item of admissionsByMonth) {
      const key = new Date(item.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
    }

    const roleMap = new Map<string, number>();
    for (const user of usersByRole) {
      const roles = user.userRoles.map((x) => x.role?.name).filter(Boolean);
      if (roles.length === 0) {
        roleMap.set('Unassigned', (roleMap.get('Unassigned') || 0) + 1);
      } else {
        for (const role of roles) {
          roleMap.set(role!, (roleMap.get(role!) || 0) + 1);
        }
      }
    }

    return {
      tenant,
      stats: {
        totalUsers,
        activeUsers,
        totalStudents,
        totalTeachers,
        totalClasses,
        totalAcademicYears,
        totalSubjects,
        totalPayments,
        totalRevenue: revenue._sum.amount || 0,
        capacityUsed,
        recentStudents,
        recentUsers,
        utilizationMetrics: {
          teacherStudentRatio:
            totalTeachers > 0 ? Math.round(totalStudents / totalTeachers) : 0,
          averageClassSize:
            totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0,
          activeUserPercentage:
            totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
        },
        charts: {
          admissionsByMonth: Array.from(monthlyMap.entries()).map(
            ([label, value]) => ({ label, value }),
          ),
          usersByRole: Array.from(roleMap.entries()).map(([label, value]) => ({
            label,
            value,
          })),
        },
      },
    };
  }

  async exportTenantData(id: string) {
    const tenant = await this.findOne(id);
    return {
      message: 'Export prepared successfully',
      tenant: { id: tenant.id, name: tenant.name },
      exportedAt: new Date().toISOString(),
      status: 'prepared',
    };
  }

  private async createDefaultRoles(tx: any, tenantId: string) {
    const defaultRoles = [
      { name: 'Admin', description: 'Administrative access', isSystem: true },
      { name: 'Principal', description: 'Principal access', isSystem: true },
      { name: 'Teacher', description: 'Teacher access', isSystem: true },
      { name: 'Student', description: 'Student access', isSystem: true },
      { name: 'Parent', description: 'Parent access', isSystem: true },
    ];

    for (const roleData of defaultRoles) {
      await tx.role.create({ data: { ...roleData, tenantId } });
    }
  }

  private generateTempPassword() {
    return Math.random().toString(36).slice(-10) + 'A!';
  }
}
