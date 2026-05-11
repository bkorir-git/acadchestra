import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private hasSuperAdminRole(user: any) {
    return user?.userRoles?.some((ur: any) => ur.role?.name === 'SuperAdmin');
  }

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

  async create(
    createUserDto: CreateUserDto,
    currentTenantId: string,
    isSuperAdmin: boolean,
  ) {
    const { email, password, roleName, ...userData } = createUserDto;

    if (!isSuperAdmin && roleName === 'SuperAdmin') {
      throw new ForbiddenException(
        'School admin cannot create SuperAdmin users',
      );
    }

    const isPlatformUser = isSuperAdmin && roleName === 'SuperAdmin';
    const targetTenantId = isPlatformUser
      ? null
      : isSuperAdmin
        ? createUserDto.tenantId
        : currentTenantId;

    if (!isPlatformUser && !targetTenantId) {
      throw new BadRequestException('Target tenant is required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    if (targetTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: targetTenantId },
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
          ...userData,
          email,
          password: hashedPassword,
          mustChangePassword: !password,
          tenantId: targetTenantId as any,
        },
      });

      if (roleName) {
        const role = await tx.role.findFirst({
          where: {
            name: roleName,
            tenantId: targetTenantId ?? undefined,
          },
        });

        if (!role) {
          throw new NotFoundException(`Role "${roleName}" not found`);
        }

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }

      return user.id;
    });

    return this.findOne(created, isSuperAdmin ? null : currentTenantId);
  }

  async findAllGlobal(
    page = 1,
    limit = 10,
    search?: string,
    role?: string,
    tenantId?: string,
    isActive?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.userRoles = { some: { role: { name: role } } };
    if (tenantId) where.tenantId = tenantId;
    if (typeof isActive === 'boolean') where.isActive = isActive;

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
          userRoles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const normalized = users.map((user: any) => {
      const isPlatform = user.userRoles?.some(
        (ur: any) => ur.role?.name === 'SuperAdmin',
      );
      if (!isPlatform) return user;
      return {
        ...user,
        tenant: null,
        tenantId: null,
      };
    });

    return {
      data: normalized,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(tenantId: string, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      NOT: {
        userRoles: {
          some: {
            role: {
              name: 'SuperAdmin',
            },
          },
        },
      },
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
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
          userRoles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId?: string | null) {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
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
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
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

  async update(
    id: string,
    tenantId: string | null,
    updateUserDto: UpdateUserDto,
  ) {
    const whereClause: any = { id };
    if (tenantId) whereClause.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (tenantId && this.hasSuperAdminRole(user)) {
      throw new ForbiddenException('School admin cannot update SuperAdmin');
    }

    const { roleName, newPassword } = updateUserDto as any;
    const safeData = this.sanitizeProfileUpdate(updateUserDto);

    if (tenantId && roleName === 'SuperAdmin') {
      throw new ForbiddenException(
        'School admin cannot assign SuperAdmin role',
      );
    }

    if (newPassword) this.validatePasswordStrength(newPassword);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(safeData).length > 0) {
        await tx.user.update({
          where: { id },
          data: safeData,
        });
      }

      if (roleName) {
        const role = await tx.role.findFirst({
          where: {
            name: roleName,
            tenantId: user.tenantId ?? undefined,
          },
        });

        if (!role) {
          throw new NotFoundException(`Role "${roleName}" not found`);
        }

        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({
          data: {
            userId: id,
            roleId: role.id,
          },
        });
      }

      if (newPassword) {
        const hashed = await bcrypt.hash(newPassword, 12);
        await tx.user.update({
          where: { id },
          data: {
            password: hashed,
            mustChangePassword: true,
          },
        });
      }
    });

    return this.findOne(id, tenantId);
  }

  async toggleUserStatus(id: string, tenantId?: string | null) {
    const whereClause: any = { id };
    if (tenantId) whereClause.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (tenantId && this.hasSuperAdminRole(user)) {
      throw new ForbiddenException('School admin cannot manage SuperAdmin');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string | null) {
    const whereClause: any = { id };
    if (tenantId) whereClause.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: {
        userRoles: {
          include: { role: true },
        },
        student: true,
        teacher: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (tenantId && this.hasSuperAdminRole(user)) {
      throw new ForbiddenException('School admin cannot delete SuperAdmin');
    }

    if (user.student || user.teacher) {
      throw new BadRequestException(
        'Cannot delete linked student/teacher user directly. Remove the linked profile first.',
      );
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async updateUserRoles(
    userId: string,
    roleIds: string[],
    tenantId?: string | null,
  ) {
    const whereClause: any = { id: userId };
    if (tenantId) whereClause.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (tenantId && this.hasSuperAdminRole(user)) {
      throw new ForbiddenException(
        'School admin cannot modify SuperAdmin roles',
      );
    }

    if (tenantId) {
      const roles = await this.prisma.role.findMany({
        where: {
          id: { in: roleIds },
          tenantId,
        },
      });

      if (roles.length !== roleIds.length) {
        throw new BadRequestException(
          'One or more roles are invalid for this tenant',
        );
      }

      if (roles.some((role) => role.name === 'SuperAdmin')) {
        throw new ForbiddenException(
          'School admin cannot assign SuperAdmin role',
        );
      }
    }

    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId,
        })),
      });
    }

    return this.findOne(userId, tenantId);
  }
}
