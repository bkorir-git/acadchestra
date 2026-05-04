/**
 * @file fee-ledger.controller.ts
 * @description Read-only ledger endpoints — tenant-wide and per-student.
 */

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FeeLedgerService } from './fee-ledger.service';
import { LedgerEntryType } from '@prisma/client';

@ApiTags('Fee Ledger')
@Controller('fees/ledger')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeeLedgerController {
  constructor(private readonly service: FeeLedgerService) {}

  @Get()
  @FeeAccess('READ_ONLY')
  tenantLedger(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('entryType') entryType?: LedgerEntryType,
    @Query('studentId') studentId?: string,
  ) {
    return this.service.getTenantLedger(user.tenantId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      entryType,
      studentId,
    });
  }

  @Get('student/:studentId')
  @FeeAccess('READ_ONLY')
  studentLedger(
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getStudentLedger(user.tenantId, studentId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
