/**
 * @file invoices.controller.ts
 * @description REST endpoints for invoices. List + detail (READ_ONLY),
 *   cancel (MANAGE), and PDF export delegated to the downloads module.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { InvoicesService } from './invoices.service';
import { FeeDownloadsService } from '../downloads/fee-downloads.service';
import { MIME, sendBinary } from '../common/sendBinary.util';

@ApiTags('Invoices')
@Controller('fees/invoices')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(
    private readonly service: InvoicesService,
    private readonly downloads: FeeDownloadsService,
  ) {}

  @Get()
  @FeeAccess('READ_ONLY')
  list(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('search') search: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Query('status') status: InvoiceStatus | undefined,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('academicTermId') academicTermId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.findAll(
      {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search,
        studentId,
        status,
        academicYearId,
        academicTermId,
      },
      user,
    );
  }

  @Get(':id')
  @FeeAccess('READ_ONLY')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Get(':id/export/pdf')
  @FeeAccess('READ_ONLY')
  async exportPdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { buffer, filenameBase } = await this.downloads.invoicePdf(
      user.tenantId,
      id,
    );
    sendBinary(res, buffer, MIME.PDF, `${filenameBase}.pdf`);
  }

  @Patch(':id/cancel')
  @FeeAccess('MANAGE')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.service.cancel(id, reason, user);
  }
}
