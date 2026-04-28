/**
 * @controller CalendarRulesController
 * @description Exposes the current phase + gate answers so the frontend
 *   can pre-disable actions the user cannot perform.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CalendarRulesService } from './calendar-rules.service';

@ApiTags('Calendar Rules')
@Controller('academic/calendar-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CalendarRulesController {
  constructor(private readonly rules: CalendarRulesService) {}

  @Get('phase')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Get current calendar phase + context' })
  getPhase(@CurrentUser() user: any) {
    return this.rules.getPhaseContext(user.tenantId);
  }

  @Get('gates')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get all gate evaluations in one call' })
  async getGates(@CurrentUser() user: any) {
    const [
      createClasses,
      editClasses,
      enrollStudents,
      generateBilling,
      recordPayments,
      createPromotionPlan,
      executePromotion,
    ] = await Promise.all([
      this.rules.canCreateClasses(user.tenantId),
      this.rules.canEditClasses(user.tenantId),
      this.rules.canEnrollStudents(user.tenantId),
      this.rules.canGenerateBilling(user.tenantId),
      this.rules.canRecordPayments(user.tenantId),
      this.rules.canCreatePromotionPlan(user.tenantId),
      this.rules.canExecutePromotion(user.tenantId),
    ]);
    return {
      createClasses,
      editClasses,
      enrollStudents,
      generateBilling,
      recordPayments,
      createPromotionPlan,
      executePromotion,
    };
  }
}
