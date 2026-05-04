import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FinancialLockService } from './financial-lock.service';

@ApiTags('Financial Lock')
@Controller('fees/financial-lock')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FinancialLockController {
  constructor(private readonly service: FinancialLockService) {}

  @Get('status')
  @FeeAccess('READ_ONLY')
  status(@CurrentUser() user: any) {
    return this.service.getStatus(user.tenantId);
  }

  @Patch('years/:id/lock')
  @FeeAccess('LOCK')
  lockYear(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.service.lockYear(id, reason, user);
  }

  @Patch('years/:id/unlock')
  @FeeAccess('LOCK')
  unlockYear(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unlockYear(id, reason, user);
  }

  @Patch('terms/:id/lock')
  @FeeAccess('LOCK')
  lockTerm(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.service.lockTerm(id, reason, user);
  }

  @Patch('terms/:id/unlock')
  @FeeAccess('LOCK')
  unlockTerm(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unlockTerm(id, reason, user);
  }
}
