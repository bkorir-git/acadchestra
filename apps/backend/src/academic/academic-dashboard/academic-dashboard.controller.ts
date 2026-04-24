/**
 * @controller AcademicDashboardController
 * @description Routes for the Academic Dashboard landing page.
 *   Mount point: /academic/dashboard
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AcademicDashboardService } from './academic-dashboard.service';

@ApiTags('Academic Dashboard')
@Controller('academic/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AcademicDashboardController {
  constructor(private readonly service: AcademicDashboardService) {}

  @Get('stats')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Summary counts (students, teachers, classes, years)' })
  getStats(@CurrentUser() user: any) {
    return this.service.getStats(user);
  }

  @Get('overview')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Full academic overview: progress + financials + classes' })
  overview(@CurrentUser() user: any) {
    return this.service.overview(user);
  }

  @Get('activity')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Recent activity feed (tenant-scoped)' })
  getActivity(@CurrentUser() user: any) {
    return this.service.getActivity(user);
  }
}
