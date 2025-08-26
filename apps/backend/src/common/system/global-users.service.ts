import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GlobalUsersFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  tenantId?: string;
  isActive?: boolean;
}

@Injectable()
export class GlobalUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: GlobalUsersFilter = {}) {
    const { page = 1, limit = 20, search, role, tenantId, isActive } = filters;
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
    
    if (tenantId) {
      where.tenantId = tenantId;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (role) {
      where.userRoles = {
        some: {
          role: {
            name: role
          }
        }
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
            }
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

    // Remove passwords from response
    const sanitizedUsers = users.map(({ password, ...user }) => user);

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
        teacher: {
          include: {
            classesAsTeacher: true,
            subjectsTaught: {
              include: {
                subject: true,
                class: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async toggleUserStatus(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
          }
        },
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async getUserStats() {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      usersByTenant,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.$queryRaw`
        SELECT r.name as role, COUNT(ur.user_id) as count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        GROUP BY r.name
        ORDER BY count DESC
      `,
      this.prisma.$queryRaw`
        SELECT t.name as tenant, COUNT(u.id) as count
        FROM tenants t
        LEFT JOIN users u ON t.id = u.tenant_id
        GROUP BY t.name
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      recentUsers,
      usersByRole,
      usersByTenant,
    };
  }
}
