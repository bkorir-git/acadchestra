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

    const targetTenantId = isSuperAdmin
      ? createUserDto.tenantId
      : currentTenantId;

    if (!targetTenantId) {
      throw new BadRequestException('Target tenant is required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: targetTenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...userData,
          email,
          password: hashedPassword,
          tenantId: targetTenantId,
        },
      });

      if (roleName) {
        const role = await tx.role.findFirst({
          where: {
            name: roleName,
            tenantId: targetTenantId,
          },
        });

        if (!role) {
          throw new NotFoundException(`Role "${roleName}" not found in tenant`);
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

  async findAllGlobal(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
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
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
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
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
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
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
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

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    return this.findOne(updated.id, tenantId);
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
