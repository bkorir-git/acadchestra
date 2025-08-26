import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    const isSuperAdmin = user.userRoles?.some(ur => ur.role.name === 'SuperAdmin');
    return this.usersService.create(createUserDto, user.tenantId, isSuperAdmin);
  }

  @Get('global')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get all users across all tenants (SuperAdmin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Global users retrieved successfully' })
  findAllGlobal(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllGlobal(page, limit, search);
  }

  @Get()
  @Roles('Admin', 'SuperAdmin', 'Principal')
  @ApiOperation({ summary: 'Get all users in tenant' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  findAll(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll(user.tenantId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.userRoles?.some(ur => ur.role.name === 'SuperAdmin');
    return this.usersService.findOne(id, isSuperAdmin ? null : user.tenantId);
  }

  @Patch(':id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    const isSuperAdmin = user.userRoles?.some(ur => ur.role.name === 'SuperAdmin');
    return this.usersService.update(id, isSuperAdmin ? null : user.tenantId, updateUserDto);
  }

  @Patch(':id/toggle-status')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Toggle user active status' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  toggleStatus(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.userRoles?.some(ur => ur.role.name === 'SuperAdmin');
    return this.usersService.toggleUserStatus(id, isSuperAdmin ? null : user.tenantId);
  }

  @Delete(':id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.userRoles?.some(ur => ur.role.name === 'SuperAdmin');
    return this.usersService.remove(id, isSuperAdmin ? null : user.tenantId);
  }
}
