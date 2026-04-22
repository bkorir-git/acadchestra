/**
 * @controller ProgressController
 * @description Progress Engine endpoints consumed by dashboards and sidebars.
 */

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ProgressService } from './progress.service';

@ApiTags('Progress Engine')
@Controller('academic/progress')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('current')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Current academic year + term + period detection' })
  async current(@CurrentUser() user: any) {
    const year = await this.progress.getCurrentAcademicYear(user.tenantId);
    if (!year) return { hasCurrentYear: false };
    const progress = await this.progress.getAcademicProgress(
      year.id,
      user.tenantId,
    );
    return { hasCurrentYear: true, ...progress };
  }

  @Get('activation-suggestions')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Terms awaiting activation' })
  suggestions(@CurrentUser() user: any) {
    return this.progress.getActivationSuggestions(user.tenantId);
  }

  @Get('mismatch')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  mismatch(@CurrentUser() user: any) {
    return this.progress.detectMismatch(user.tenantId);
  }

  @Get('year/:id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  year(@Param('id') id: string, @CurrentUser() user: any) {
    return this.progress.getAcademicProgress(id, user.tenantId);
  }

  @Get('term/:id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  term(@Param('id') id: string, @CurrentUser() user: any) {
    return this.progress.getTermProgress(id, user.tenantId);
  }
}
