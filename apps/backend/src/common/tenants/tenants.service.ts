import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../../common/config/config.service';
import { AdmissionCounterService } from '../../common/admission-counter/admission-counter.service';
import { EmailService } from '../../common/email/email.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SYSTEM_ROLES } from '../../../prisma/seeds/system-roles.seed';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly admissionCounter: AdmissionCounterService,
    private readonly email: EmailService,
  ) {}

  // ──────────────────────────────────────── CREATE
  async create(dto: CreateTenantDto, opts?: { loginUrl?: string }) {
    const {
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPhone,
      adminPassword,
      sendWelcomeEmail,
      ...tenantData
    } = dto;

    // Pre-flight conflict checks
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { domain: tenantData.domain },
          ...(tenantData.subdomain
            ? [{ subdomain: tenantData.subdomain }]
            : []),
        ],
      },
    });
    if (existingTenant)
      throw new ConflictException('Domain or subdomain already exists');

    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: adminEmail.toLowerCase().trim() },
    });
    if (existingAdmin)
      throw new ConflictException('Admin email already in use');

    const password = adminPassword?.trim() || this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Atomic bootstrap
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tenant
      const tenant = await tx.tenant.create({
        data: {
          ...tenantData,
          email: tenantData.email.toLowerCase().trim(),
          domain: tenantData.domain.toLowerCase().trim(),
          subdomain: tenantData.subdomain?.toLowerCase().trim(),
          onboardingStartedAt: new Date(),
        },
      });

      // 2. System roles (incl. Finance)
      const createdRoles = await Promise.all(
        SYSTEM_ROLES.map((r) =>
          tx.role.create({
            data: {
              name: r.name,
              description: r.description,
              isSystem: true,
              tenantId: tenant.id,
            },
          }),
        ),
      );
      const adminRole = createdRoles.find((r) => r.name === 'Admin')!;

      // 3. Bootstrap Admin user
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail.toLowerCase().trim(),
          password: hashedPassword,
          firstName: adminFirstName.trim(),
          lastName: adminLastName.trim(),
          phone: adminPhone,
          tenantId: tenant.id,
          isEmailVerified: false,
          mustChangePassword: !adminPassword,
        },
      });
      await tx.userRole.create({
        data: { userId: adminUser.id, roleId: adminRole.id },
      });

      // 4. TenantSettings
      await tx.tenantSettings.create({ data: { tenantId: tenant.id } });

      // 5. Configs
      await this.config.seedDefaultsForTenant(tenant.id, tx);

      // 6. AdmissionCounter
      await this.admissionCounter.ensure(tenant.id, undefined, tx);

      return { tenant, adminUser, password, generated: !adminPassword };
    });

    // Side-effect: welcome email
    let emailStatus: 'queued' | 'sent' | 'skipped' | 'failed' = 'skipped';
    if (sendWelcomeEmail) {
      try {
        const r = await this.email.send({
          to: result.adminUser.email,
          toName: `${result.adminUser.firstName} ${result.adminUser.lastName}`,
          tenantId: result.tenant.id,
          templateCode: 'welcome',
          variables: {
            tenant: { name: result.tenant.name, domain: result.tenant.domain },
            user: {
              firstName: result.adminUser.firstName,
              lastName: result.adminUser.lastName,
              email: result.adminUser.email,
              temporaryPassword: result.generated
                ? result.password
                : '(set manually)',
            },
            links: {
              login: opts?.loginUrl ?? `https://${result.tenant.domain}/login`,
            },
          },
        });
        emailStatus = r.status === 'SENT' ? 'sent' : 'queued';
      } catch (err: any) {
        this.logger.warn(`Welcome email failed: ${err?.message}`);
        emailStatus = 'failed';
      }
    }

    return {
      ...result.tenant,
      bootstrapAdmin: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName,
        passwordMode: result.generated
          ? 'temporary_password_generated'
          : 'manual_password_set',
        temporaryPassword: result.generated ? result.password : undefined,
        welcomeEmailRequested: !!sendWelcomeEmail,
        welcomeEmailStatus: emailStatus,
      },
    };
  }

  // ──────────────────────────────────────── READ
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

    const where: Prisma.TenantWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (planType) where.planType = planType as any;
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
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
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
            curriculums: true,
          },
        },
        admissionCounter: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  // ──────────────────────────────────────── UPDATE
  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (dto.domain || dto.subdomain) {
      const conflict = await this.prisma.tenant.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(dto.domain ? [{ domain: dto.domain }] : []),
                ...(dto.subdomain ? [{ subdomain: dto.subdomain }] : []),
              ],
            },
          ],
        },
      });
      if (conflict) throw new ConflictException('Domain or subdomain in use');
    }

    const {
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPhone,
      adminPassword,
      sendWelcomeEmail,
      ...tenantData
    } = dto as any;

    const updated = await this.prisma.tenant.update({
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

    // Optionally update bootstrap admin
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
          const existing = await this.prisma.user.findUnique({
            where: { email: adminEmail },
          });
          if (existing && existing.id !== currentAdmin.id) {
            throw new ConflictException('Admin email already exists');
          }
          userData.email = adminEmail.toLowerCase().trim();
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

    return updated;
  }

  async toggleStatus(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: !tenant.isActive },
    });
  }

  async getStats(id: string) {
    const tenant = await this.findOne(id);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
        where: { tenantId: id, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count({
        where: { tenantId: id, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.student.findMany({
        where: { tenantId: id },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { tenantId: id },
        select: {
          userRoles: { select: { role: { select: { name: true } } } },
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
      const roles = user.userRoles
        .map((x) => x.role?.name)
        .filter(Boolean) as string[];
      if (roles.length === 0) {
        roleMap.set('Unassigned', (roleMap.get('Unassigned') || 0) + 1);
      } else {
        for (const r of roles) roleMap.set(r, (roleMap.get(r) || 0) + 1);
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

  // ──────────────────────────────────────── EXPORT
  async exportTenantData(id: string) {
    const tenant = await this.findOne(id);

    const [students, teachers, classes, academicYears, feePayments] =
      await Promise.all([
        this.prisma.student.findMany({ where: { tenantId: id } }),
        this.prisma.teacher.findMany({ where: { tenantId: id } }),
        this.prisma.class.findMany({ where: { tenantId: id } }),
        this.prisma.academicYear.findMany({ where: { tenantId: id } }),
        this.prisma.feePayment.findMany({ where: { tenantId: id } }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        email: tenant.email,
        planType: tenant.planType,
      },
      counts: {
        students: students.length,
        teachers: teachers.length,
        classes: classes.length,
        academicYears: academicYears.length,
        feePayments: feePayments.length,
      },
      data: { students, teachers, classes, academicYears, feePayments },
    };
  }

  // ──────────────────────────────────────── DELETE
  async remove(id: string, adminPassword: string, adminUserId: string) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });
    if (!adminUser) throw new UnauthorizedException('Admin user not found');

    const valid = await bcrypt.compare(adminPassword, adminUser.password);
    if (!valid) throw new UnauthorizedException('Invalid admin password');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { students: true, teachers: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (tenant._count.students > 0 || tenant._count.teachers > 0) {
      throw new BadRequestException(
        `Cannot delete tenant with existing data: ${tenant._count.students} students, ${tenant._count.teachers} teachers.`,
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
      message: 'Tenant deleted',
      deletedTenant: { name: tenant.name, domain: tenant.domain },
    };
  }

  // ──────────────────────────────────────── HELPERS
  private generateTempPassword(): string {
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const all = lower + upper + digits + symbols;
    let pw =
      upper[Math.floor(Math.random() * upper.length)] +
      lower[Math.floor(Math.random() * lower.length)] +
      digits[Math.floor(Math.random() * digits.length)] +
      symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 0; i < 8; i++)
      pw += all[Math.floor(Math.random() * all.length)];
    return pw
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
