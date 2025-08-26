import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Roles & Permissions')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Create new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  create(@Body() createRoleDto: CreateRoleDto, @CurrentUser() user: any) {
    return this.rolesService.create(createRoleDto, user.tenantId);
  }

  @Get()
  @Roles('Admin', 'SuperAdmin', 'Principal')
  @ApiOperation({ summary: 'Get all roles for tenant' })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  findAll(
    @CurrentUser() user: any,
    @Query('includeSystem') includeSystem?: string,
  ) {
    const include = includeSystem === 'true';
    return this.rolesService.findAll(user.tenantId, include);
  }

  @Get('permissions')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Get all available permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }

  @Get(':id')
  @Roles('Admin', 'SuperAdmin', 'Principal')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rolesService.findOne(id, user.tenantId);
  }

  @Get(':id/users')
  @Roles('Admin', 'SuperAdmin', 'Principal')
  @ApiOperation({ summary: 'Get users assigned to role' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  getUsersByRole(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rolesService.getUsersByRole(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: any,
  ) {
    return this.rolesService.update(id, updateRoleDto, user.tenantId);
  }

  @Patch(':id/permissions')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Assign permissions to role' })
  @ApiResponse({ status: 200, description: 'Permissions assigned successfully' })
  assignPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, assignPermissionsDto);
  }

  @Delete(':id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Delete role' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rolesService.remove(id, user.tenantId);
  }
}
