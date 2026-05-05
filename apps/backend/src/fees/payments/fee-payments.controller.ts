/**
 * @file fee-payments.controller.ts
 * @description Payments controller — record, list, get, void, receipt PDF.
 *   Receipt rendering is delegated to the downloads module via a thin
 *   redirect endpoint kept here for backward compatibility.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FeePaymentsService } from './fee-payments.service';
import { RecordPaymentDto, VoidPaymentDto } from './dto/record-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { PdfRendererService } from '../downloads/pdf-renderer.service';
import { receiptTemplate } from '../downloads/templates/receipt.template';
import { PrismaService } from '../../database/prisma.service';
import { MIME, sendBinary } from '../common/sendBinary.util';

@ApiTags('Fee Payments')
@Controller('fees/payments')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeePaymentsController {
  constructor(
    private readonly service: FeePaymentsService,
    private readonly pdf: PdfRendererService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @FeeAccess('MANAGE')
  @ApiOperation({ summary: 'Record a payment with FIFO allocation' })
  record(@Body() dto: RecordPaymentDto, @CurrentUser() user: any) {
    return this.service.record(dto, user);
  }

  @Get()
  @FeeAccess('READ_ONLY')
  findAll(@Query() query: QueryPaymentsDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @FeeAccess('READ_ONLY')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Get(':id/receipt/pdf')
  @FeeAccess('READ_ONLY')
  async receipt(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const payment = await this.service.findOne(id, user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { settings: true },
    });
    const html = receiptTemplate({ payment, tenant });
    const buffer = await this.pdf.renderHtml(html, { format: 'A4' });
    sendBinary(res, buffer, MIME.PDF, `receipt-${payment.receiptNumber}.pdf`);
  }

  @Patch(':id/void')
  @FeeAccess('VOID')
  voidPayment(
    @Param('id') id: string,
    @Body() dto: VoidPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.voidPayment(id, dto, user);
  }
}