import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, tenantId: any, isSuperAdmin: any) {
    const { email, password, roleName, ...userData } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          ...userData,
          email,
          password: hashedPassword,
        },
        include: {
          tenant: true,
        },
      });

      // If roleName provided, assign the role
      if (roleName) {
        const role = await tx.role.findFirst({
          where: { 
            name: roleName, 
            tenantId: userData.tenantId 
          },
        });

        if (role) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
            },
          });
        }
      }

      return tx.user.findUnique({
        where: { id: user.id },
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
          password: true,
          tenant: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    // TypeScript assertion to ensure result is not null (we know it exists)
    if (!result) {
      throw new Error('Failed to create user');
    }

    const { password: _, ...userWithoutPassword } = result;
    return userWithoutPassword;
  }

  async findAllGlobal(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    // Build where clause
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

  async findAll(tenantId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
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
      this.prisma.user.count({ where: { tenantId } }),
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

  async findOne(id: string, tenantId?: string) {
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

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, tenantId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
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
    });

    return updatedUser;
  }

  async toggleUserStatus(id: string, tenantId?: string) {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
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
    });

    return updatedUser;
  }

  async remove(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async assignRole(userId: string, roleId: string, tenantId: string) {
    // Verify user and role belong to the same tenant
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, tenantId },
      }),
      this.prisma.role.findFirst({
        where: { id: roleId, tenantId },
      }),
    ]);

    if (!user || !role) {
      throw new NotFoundException('User or role not found');
    }

    // Check if user already has this role
    const existingUserRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingUserRole) {
      throw new ConflictException('User already has this role');
    }

    return this.prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
      include: {
        role: true,
      },
    });
  }

  async removeRole(userId: string, roleId: string, tenantId: string) {
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      include: {
        user: true,
        role: true,
      },
    });

    if (!userRole || userRole.user.tenantId !== tenantId) {
      throw new NotFoundException('User role not found');
    }

    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    return { message: 'Role removed successfully' };
  }
}