/**
 * @file onboarding.controller.ts
 * @module onboarding
 * @description Endpoints:
 *   GET   /onboarding/checklist        — current state, unlocked next step
 *   POST  /onboarding/dismiss          — admin force-completes the wizard
 *   POST  /onboarding/step/:step/done  — explicit mark-done (mostly informational)
 *
 *   The actual mutations (adopt curriculum, create year, write configs) live in
 *   their respective domain modules — `/curriculum/adopt`, `/academic-years`,
 *   `/config/bulk`. This controller only OBSERVES progress.
 */

import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnboardingStep } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get('checklist')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Get current onboarding state for this tenant' })
  checklist(@CurrentUser() user: any) {
    return this.service.getChecklist(user.tenantId);
  }

  @Post('step/:step/done')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Mark a step as done (informational)' })
  markDone(@Param('step') step: OnboardingStep, @CurrentUser() user: any) {
    return this.service.markStepDone(user.tenantId, step, user.id);
  }

  @Post('dismiss')
  @Roles('Admin')
  @ApiOperation({ summary: 'Dismiss the wizard (admin override)' })
  dismiss(@CurrentUser() user: any) {
    return this.service.dismiss(user.tenantId, user.id);
  }
}
