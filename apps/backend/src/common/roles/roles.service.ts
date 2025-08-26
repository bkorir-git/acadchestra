import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto, tenantId: string) {
    const { name, description, permissions } = createRoleDto;

    // Check if role already exists in this tenant
    const existingRole = await this.prisma.role.findUnique({
      where: {
        name_tenantId: {
          name,
          tenantId,
        },
      },
    });

    if (existingRole) {
      throw new ConflictException('Role with this name already exists in this tenant');
    }

    // Create role
    const role = await this.prisma.role.create({
      data: {
        name,
        description,
        tenantId,
        isSystem: false,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // Assign permissions if provided
    if (permissions && permissions.length > 0) {
      await this.assignPermissions(role.id, { permissionIds: permissions });
    }

    return this.findOne(role.id, tenantId);
  }

  async findAll(tenantId: string, includeSystem = true) {
    const where: any = { tenantId };
    
    if (!includeSystem) {
      where.isSystem = false;
    }

    return this.prisma.role.findMany({
      where,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }

    // Check name conflict if updating name
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.prisma.role.findUnique({
        where: {
          name_tenantId: {
            name: updateRoleDto.name,
            tenantId,
          },
        },
      });

      if (existingRole) {
        throw new ConflictException('Role with this name already exists');
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    return updatedRole;
  }

  async remove(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    if (role._count.userRoles > 0) {
      throw new BadRequestException('Cannot delete role that is assigned to users');
    }

    await this.prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });
  }

  async assignPermissions(roleId: string, assignPermissionsDto: AssignPermissionsDto) {
    const { permissionIds } = assignPermissionsDto;

    // Remove existing permissions
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map(permissionId => ({
        roleId,
        permissionId,
      }));

      await this.prisma.rolePermission.createMany({
        data: rolePermissions,
      });
    }

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async getUsersByRole(roleId: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.prisma.user.findMany({
      where: {
        tenantId,
        userRoles: {
          some: {
            roleId,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });
  }
}
