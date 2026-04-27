/**
 * @file backups.controller.ts
 * @description SuperAdmin backup + restore endpoints.
 */

import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BackupsService } from './backups.service';
import { RestoreService } from './restore.service';
import { R2StorageProvider } from './storage/r2-storage.provider';
import {
  CreateBackupDto, RestoreBackupDto, UpdateBackupPolicyDto,
} from './dto/backups.dto';

@ApiTags('Backups')
@Controller('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BackupsController {
  constructor(
    private readonly backups: BackupsService,
    private readonly restore: RestoreService,
    private readonly r2: R2StorageProvider,
  ) {}

  @Get('policy')
  @Roles('SuperAdmin')
  getPolicy() {
    return this.backups.getPolicy();
  }

  @Patch('policy')
  @Roles('SuperAdmin')
  updatePolicy(@Body() dto: UpdateBackupPolicyDto, @CurrentUser() user: any) {
    return this.backups.updatePolicy(dto, user.id);
  }

  @Get('r2-status')
  @Roles('SuperAdmin')
  async r2Status() {
    return { configured: await this.r2.isConfigured() };
  }

  @Get('jobs')
  @Roles('SuperAdmin')
  list() {
    return this.backups.listJobs();
  }

  @Get('jobs/:id')
  @Roles('SuperAdmin')
  findOne(@Param('id') id: string) {
    return this.backups.findJob(id);
  }

  @Get('jobs/:id/download-url')
  @Roles('SuperAdmin')
  signedUrl(@Param('id') id: string) {
    return this.backups.signedUrl(id);
  }

  @Post()
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Create a manual backup now' })
  create(@Body() dto: CreateBackupDto, @CurrentUser() user: any) {
    return this.backups.createBackup(dto, user.id);
  }

  // ── RESTORE ───────────────────────────────────
  @Get('restores')
  @Roles('SuperAdmin')
  listRestores() {
    return this.restore.listRestores();
  }

  @Post('restore')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Restore database from a backup. OVERWRITES the entire database.' })
  performRestore(@Body() dto: RestoreBackupDto, @CurrentUser() user: any) {
    return this.restore.restore(dto, user.id);
  }
}
