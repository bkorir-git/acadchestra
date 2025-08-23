import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

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
    });

    // Create default roles for the tenant
    await this.createDefaultRoles(tenant.id);

    return tenant;
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
            },
          },
        },
      }),
      this.prisma.tenant.count(),
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

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Tenant deleted successfully' };
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