import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics based on user role' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  async getStats(@CurrentUser() user: any) {
    return this.dashboardService.getStats(user);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity for dashboard' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
  async getActivity(@CurrentUser() user: any) {
    return this.dashboardService.getRecentActivity(user);
  }
}
