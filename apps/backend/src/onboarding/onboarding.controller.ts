/**
 * @description Onboarding controller — Phase 3.
 *   Exposes GET /onboarding/checklist for Admin and Principal roles.
 *   Teachers don't see onboarding — they have no authority to fix the
 *   missing pieces.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('checklist')
  @Roles('Admin', 'Principal')
  @ApiOperation({
    summary:
      'Get the onboarding checklist for the current tenant — used to render a setup banner on the admin dashboard.',
  })
  @ApiResponse({ status: 200, description: 'Checklist with next actionable step' })
  getChecklist(@CurrentUser() user: any) {
    return this.onboardingService.getChecklist(user.tenantId);
  }
}