/**
 * @description Dashboard controller serving role-aware stats and recent activity.
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({
    name: 'academicYearId',
    required: false,
    description:
      'Reserved for future use. Currently the service resolves the current year internally.',
  })
  getStats(
    @CurrentUser() user: any,
    @Query('academicYearId') _academicYearId?: string,
  ) {
    return this.dashboardService.getStats(user);
  }

  @Get('activity')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get recent dashboard activity' })
  getActivity(@CurrentUser() user: any) {
    return this.dashboardService.getActivity(user);
  }
}
