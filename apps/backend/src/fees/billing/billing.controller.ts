/**
 * @file billing.controller.ts
 * @description Billing endpoints — preview (READ_ONLY) and execute (MANAGE).
 *   Manual only: admins must POST /execute explicitly. No cron, no surprise
 *   billing.
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { BillingService } from './billing.service';
import {
  ExecuteBillingDto,
  PreviewBillingDto,
} from './dto/preview-billing.dto';

@ApiTags('Fee Billing')
@Controller('fees/billing')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Post('preview')
  @FeeAccess('READ_ONLY')
  @ApiOperation({ summary: 'Dry-run billing for a year/term' })
  preview(@Body() dto: PreviewBillingDto, @CurrentUser() user: any) {
    return this.service.preview(dto, user);
  }

  @Post('execute')
  @FeeAccess('MANAGE')
  @ApiOperation({
    summary: 'Execute billing — creates StudentFees + Invoices + ledger entries',
  })
  execute(@Body() dto: ExecuteBillingDto, @CurrentUser() user: any) {
    return this.service.execute(dto, user);
  }
}