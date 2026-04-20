import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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

  @Get('health')
  @Roles('SuperAdmin')
  getHealth() {
    return this.systemService.getSystemHealth();
  }

  @Get('metrics')
  @Roles('SuperAdmin')
  getMetrics() {
    return this.systemService.getSystemMetrics();
  }

  @Get('users')
  @Roles('SuperAdmin')
  getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('tenantId') tenantId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.globalUsersService.findAll({
      page,
      limit,
      search,
      role,
      tenantId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get('users/stats')
  @Roles('SuperAdmin')
  getUserStats() {
    return this.globalUsersService.getUserStats();
  }

  @Get('users/:id')
  @Roles('SuperAdmin')
  getUser(@Param('id') id: string) {
    return this.globalUsersService.findOne(id);
  }

  @Post('users')
  @Roles('SuperAdmin')
  createUser(@Body() data: any) {
    return this.globalUsersService.create(data);
  }

  @Patch('users/:id')
  @Roles('SuperAdmin')
  updateUser(@Param('id') id: string, @Body() data: any) {
    return this.globalUsersService.update(id, data);
  }

  @Delete('users/:id')
  @Roles('SuperAdmin')
  deleteUser(@Param('id') id: string) {
    return this.globalUsersService.delete(id);
  }

  @Patch('users/:id/toggle-status')
  @Roles('SuperAdmin')
  toggleUserStatus(@Param('id') id: string) {
    return this.globalUsersService.toggleUserStatus(id);
  }

  @Post('users/:id/reset-password')
  @Roles('SuperAdmin')
  resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.globalUsersService.resetPassword(id, body.newPassword);
  }

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
  @ApiOperation({ summary: 'Create a database backup' })
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
  @ApiOperation({ summary: 'Get system logs' })
  getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.systemService.getSystemLogs(page, limit);
  }
}
