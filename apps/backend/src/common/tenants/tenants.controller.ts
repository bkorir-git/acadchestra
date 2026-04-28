/**
 * @file tenants.controller.ts
 * @description SuperAdmin tenant management endpoints.
 */

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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto, DeleteTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create new tenant (SuperAdmin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - SuperAdmin only' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'List tenants with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'planType', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('planType') planType?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.tenantsService.findAll({
      page,
      limit,
      search,
      planType,
      isActive,
    });
  }

  @Get(':id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get tenant by ID (SuperAdmin only)' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Update tenant (SuperAdmin only)' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Patch(':id/toggle-status')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Toggle tenant active status (SuperAdmin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant status updated successfully',
  })
  toggleStatus(@Param('id') id: string) {
    return this.tenantsService.toggleStatus(id);
  }

  @Get(':id/stats')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get tenant statistics (SuperAdmin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant statistics retrieved successfully',
  })
  getStats(@Param('id') id: string) {
    return this.tenantsService.getStats(id);
  }

  @Get(':id/export')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Export tenant data as JSON' })
  exportTenantData(@Param('id') id: string) {
    return this.tenantsService.exportTenantData(id);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @ApiOperation({
    summary: 'Delete tenant with password confirmation (SuperAdmin only)',
  })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  remove(
    @Param('id') id: string,
    @Body() deleteDto: DeleteTenantDto,
    @CurrentUser() user: any,
  ) {
    return this.tenantsService.remove(id, deleteDto.adminPassword, user.id);
  }
}
