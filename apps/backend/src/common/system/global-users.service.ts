import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

export interface GlobalUsersFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  tenantId?: string;
  isActive?: boolean;
}

export interface CreateGlobalUserDto {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId?: string;
  roleName?: string;
  sendWelcomeEmail?: boolean;
}

export interface UpdateGlobalUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
  tenantId?: string;
}

@Injectable()
export class GlobalUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: GlobalUsersFilter = {}) {
    const { page = 1, limit = 20, search, role, tenantId, isActive } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tenantId) where.tenantId = tenantId;
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (role) {
      where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              domain: true,
            },
          },
          userRoles: {
            include: {
              role: true,
            },
          },
          student: true,
          teacher: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const sanitizedUsers = users.map(({ password, ...user }) => ({
      ...user,
      platformScope: user.userRoles?.some(
        (ur) => ur.role?.name === 'SuperAdmin',
      ),
    }));

    return {
      data: sanitizedUsers,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        student: {
          include: {
            class: {
              include: {
                academicYear: true,
              },
            },
          },
        },
        teacher: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      platformScope: safeUser.userRoles?.some(
        (ur) => ur.role?.name === 'SuperAdmin',
      ),
    };
  }

  async create(data: CreateGlobalUserDto) {
    if (!data.tenantId) {
      throw new BadRequestException('tenantId is required for user creation');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const password = data.password?.trim() || this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        tenantId: data.tenantId,
        isEmailVerified: false,
      },
    });

    if (data.roleName) {
      const role = await this.prisma.role.findFirst({
        where: {
          name: data.roleName,
          tenantId: data.tenantId,
        },
      });

      if (role) {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }
    }

    return {
      ...(await this.findOne(user.id)),
      onboarding: {
        passwordMode: data.password
          ? 'manual_password_set'
          : 'temporary_password_generated',
        temporaryPassword: data.password ? undefined : password,
        welcomeEmailRequested: !!data.sendWelcomeEmail,
        welcomeEmailStatus: data.sendWelcomeEmail
          ? 'pending_integration'
          : 'not_requested',
      },
    };
  }

  async update(id: string, data: UpdateGlobalUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!existing) throw new NotFoundException('User not found');

    const isPlatformUser = existing.userRoles.some(
      (ur) => ur.role?.name === 'SuperAdmin',
    );
    if (
      isPlatformUser &&
      typeof data.tenantId === 'string' &&
      data.tenantId !== existing.tenantId
    ) {
      throw new ForbiddenException(
        'Platform SuperAdmin users cannot be moved between schools',
      );
    }

    if (data.tenantId && data.tenantId !== existing.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: data.tenantId },
      });
      if (!tenant) throw new NotFoundException('Target tenant not found');
    }

    await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.findOne(id);
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        student: true,
        teacher: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.userRoles.some((ur) => ur.role?.name === 'SuperAdmin')) {
      throw new ForbiddenException(
        'Platform SuperAdmin users cannot be deleted from global users management',
      );
    }

    if (user.student || user.teacher) {
      throw new BadRequestException(
        'Cannot delete a user linked to a student or teacher profile. Delete the linked profile first.',
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async toggleUserStatus(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.userRoles.some((ur) => ur.role?.name === 'SuperAdmin')) {
      throw new ForbiddenException(
        'Platform SuperAdmin users cannot be deactivated here',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    return this.findOne(id);
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { message: 'Password reset successfully' };
  }

  async getUserStats() {
    const [totalUsers, activeUsers, recentUsers, users, tenants] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.user.findMany({
          select: {
            id: true,
            tenantId: true,
            userRoles: {
              select: {
                role: {
                  select: { name: true },
                },
              },
            },
          },
        }),
        this.prisma.tenant.findMany({
          select: {
            id: true,
            name: true,
          },
        }),
      ]);

    const roleMap = new Map<string, number>();
    const tenantMap = new Map<string, number>();
    const tenantNameMap = new Map(tenants.map((t) => [t.id, t.name]));

    for (const user of users) {
      const tenantName = tenantNameMap.get(user.tenantId) || 'Unknown';
      tenantMap.set(tenantName, (tenantMap.get(tenantName) || 0) + 1);

      const roleNames = user.userRoles
        .map((ur) => ur.role?.name)
        .filter(Boolean);
      if (roleNames.length === 0) {
        roleMap.set('Unassigned', (roleMap.get('Unassigned') || 0) + 1);
      } else {
        for (const roleName of roleNames) {
          roleMap.set(roleName!, (roleMap.get(roleName!) || 0) + 1);
        }
      }
    }

    const usersByRole = Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    const usersByTenant = Array.from(tenantMap.entries())
      .map(([tenant, count]) => ({ tenant, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalUsers,
      activeUsers,
      recentUsers,
      usersByRole,
      usersByTenant,
    };
  }

  private generateTempPassword() {
    return Math.random().toString(36).slice(-10) + 'A!';
  }
}
