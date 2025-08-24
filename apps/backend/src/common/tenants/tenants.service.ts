import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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

  async remove(id: string) {
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

    // Check if tenant has active users
    if (tenant._count.users > 0) {
      throw new BadRequestException('Cannot delete tenant with active users');
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Tenant deleted successfully' };
  }

  async getStats(id: string) {
    const tenant = await this.findOne(id);
    
    const [
      totalUsers,
      activeUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      recentActivity,
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
      this.prisma.user.findMany({
        where: { tenantId: id },
        orderBy: { lastLogin: 'desc' },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          lastLogin: true,
          userRoles: {
            include: { role: true }
          }
        }
      }),
    ]);

    return {
      tenant,
      stats: {
        totalUsers,
        activeUsers,
        totalStudents,
        totalTeachers,
        totalClasses,
        storageUsed: Math.floor(Math.random() * 1000), // Mock data
        capacityUsed: Math.round((totalStudents / tenant.maxStudents) * 100),
      },
      recentActivity,
    };
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
}