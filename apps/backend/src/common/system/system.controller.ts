import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { GlobalUsersService } from './global-users.service';
import { DatabaseService } from './database.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('System')
@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly globalUsersService: GlobalUsersService,
    private readonly databaseService: DatabaseService,
  ) {}

  // System Health & Monitor endpoints
  @Get('health')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get system health status' })
  getHealth() {
    return this.systemService.getSystemHealth();
  }

  @Get('metrics')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get system metrics and analytics' })
  getMetrics() {
    return this.systemService.getSystemMetrics();
  }

  // Global Users endpoints
  @Get('users')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get all users across all tenants' })
  getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('tenantId') tenantId?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.globalUsersService.findAll({ page, limit, search, role, tenantId, isActive });
  }

  @Get('users/stats')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get global user statistics' })
  getUserStats() {
    return this.globalUsersService.getUserStats();
  }

  @Get('users/:id')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get specific user details' })
  getUser(@Param('id') id: string) {
    return this.globalUsersService.findOne(id);
  }

  @Patch('users/:id/toggle-status')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Toggle user active status' })
  toggleUserStatus(@Param('id') id: string) {
    return this.globalUsersService.toggleUserStatus(id);
  }

  // Database Management endpoints
  @Get('database/stats')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get database table statistics' })
  getDatabaseStats() {
    return this.databaseService.getDatabaseStats();
  }

  @Get('database/health')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get database health status' })
  getDatabaseHealth() {
    return this.databaseService.getDatabaseHealth();
  }

  @Get('database/backups')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get backup history' })
  getBackupHistory() {
    return this.databaseService.getBackupHistory();
  }

  @Post('database/backup')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create database backup' })
  createBackup() {
    return this.databaseService.createBackup();
  }

  @Post('database/maintenance')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Perform database maintenance' })
  performMaintenance() {
    return this.databaseService.performMaintenance();
  }

  @Get('logs')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Get system audit logs' })
  getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.systemService.getSystemLogs(page, limit);
  }
}
