/**
 * @file global-users.service.ts
 * @description SuperAdmin-only service for managing users across the platform.
 *   Supports profile update, role management, password change, and immutable
 *   tenant assignment.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class GlobalUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private validatePasswordStrength(password: string) {
    const strongEnough =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!strongEnough) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol',
      );
    }
  }

  private sanitizeProfileUpdate(input: any) {
    const {
      tenantId,
      roleName,
      newPassword,
      password,
      email,
      id,
      userRoles,
      ...rest
    } = input || {};
    return rest;
  }

  async findAll(filters: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    tenantId?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, search, role, tenantId, isActive } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (tenantId) where.tenantId = tenantId;
    if (role) where.userRoles = { some: { role: { name: role } } };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          dateOfBirth: true,
          gender: true,
          isEmailVerified: true,
          isTwoFactorEnabled: true,
          mustChangePassword: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          tenantId: true,
          tenant: true,
          userRoles: { include: { role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const normalized = users.map((u: any) => {
      const isPlatform = u.userRoles?.some(
        (ur: any) => ur.role?.name === 'SuperAdmin',
      );
      return isPlatform ? { ...u, tenant: null, tenantId: null } : u;
    });

    return {
      data: normalized,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        isEmailVerified: true,
        isTwoFactorEnabled: true,
        mustChangePassword: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        student: true,
        teacher: true,
        guardian: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: any) {
    const {
      email,
      password,
      roleName = 'Admin',
      tenantId,
      sendWelcomeEmail,
      ...rest
    } = data;

    if (!email) throw new BadRequestException('Email is required');

    const isPlatformUser = roleName === 'SuperAdmin';
    if (!isPlatformUser && !tenantId) {
      throw new BadRequestException(
        'tenantId is required for non-SuperAdmin users',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ConflictException('User with this email already exists');

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
    }

    if (password) this.validatePasswordStrength(password);

    const finalPassword =
      password || `Temp@${Math.random().toString(36).slice(2, 10)}!`;
    const hashedPassword = await bcrypt.hash(finalPassword, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...rest,
          email,
          password: hashedPassword,
          mustChangePassword: !password,
          tenantId: isPlatformUser ? null : tenantId,
        } as any,
      });

      const role = await tx.role.findFirst({
        where: {
          name: roleName,
          tenantId: isPlatformUser ? undefined : tenantId,
        },
      });
      if (!role) throw new NotFoundException(`Role "${roleName}" not found`);

      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });

      return user.id;
    });

    return this.findOne(created);
  }

  async update(id: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    const { roleName, newPassword } = data || {};
    const safe = this.sanitizeProfileUpdate(data);

    if (!user.tenantId && roleName && roleName !== 'SuperAdmin') {
      throw new BadRequestException(
        'Platform users can only keep the SuperAdmin role',
      );
    }

    if (newPassword) this.validatePasswordStrength(newPassword);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(safe).length > 0) {
        await tx.user.update({ where: { id }, data: safe });
      }

      if (roleName) {
        const role = await tx.role.findFirst({
          where: {
            name: roleName,
            tenantId: user.tenantId ?? undefined,
          },
        });

        if (!role) throw new NotFoundException(`Role "${roleName}" not found`);

        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({
          data: { userId: id, roleId: role.id },
        });
      }

      if (newPassword) {
        const hashed = await bcrypt.hash(newPassword, 12);
        await tx.user.update({
          where: { id },
          data: { password: hashed, mustChangePassword: true },
        });
      }
    });

    return this.findOne(id);
  }

  async toggleUserStatus(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
    return this.findOne(id);
  }

  async resetPassword(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    this.validatePasswordStrength(newPassword);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed, mustChangePassword: true },
    });
    return { message: 'Password reset successfully' };
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { student: true, teacher: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.student || user.teacher) {
      throw new BadRequestException(
        'Cannot delete a user linked to a student/teacher profile. Remove the linked profile first.',
      );
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async getUserStats() {
    const [totalUsers, activeUsers, recentUsers, byRole, byTenant] =
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
        this.prisma.role.findMany({
          select: {
            name: true,
            _count: { select: { userRoles: true } },
          },
        }),
        this.prisma.tenant.findMany({
          select: {
            name: true,
            _count: { select: { users: true } },
          },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      recentUsers,
      usersByRole: byRole.map((r) => ({
        role: r.name,
        count: r._count.userRoles,
      })),
      usersByTenant: byTenant.map((t) => ({
        tenant: t.name,
        count: t._count.users,
      })),
    };
  }
}
