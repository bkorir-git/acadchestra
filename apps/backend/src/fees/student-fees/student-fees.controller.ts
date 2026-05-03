/**
 * @file student-fees.controller.ts
 * @description Student Fees endpoints — list, search, detail, statement,
 *   statement PDF download. PDF rendering uses Puppeteer via the downloads
 *   module to keep template/runtime concerns separate from data fetching.
 */

import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { StudentFeesService } from './student-fees.service';
import { StudentStatementService } from './student-statement.service';
import { QueryStudentFeesDto } from './dto/query-student-fees.dto';
import { PdfRendererService } from '../downloads/pdf-renderer.service';
import { statementTemplate } from '../downloads/templates/statement.template';
import { MIME, sendBinary } from '../common/sendBinary.util';

@ApiTags('Student Fees')
@Controller('fees/student-fees')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class StudentFeesController {
  constructor(
    private readonly service: StudentFeesService,
    private readonly statement: StudentStatementService,
    private readonly pdf: PdfRendererService,
  ) {}

  @Get()
  @FeeAccess('READ_ONLY')
  findAll(@Query() query: QueryStudentFeesDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user);
  }

  @Get('search')
  @FeeAccess('READ_ONLY')
  search(
    @Query('q') q: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.searchForPayment(q, user, limit ? Number(limit) : 20);
  }

  @Get('statement/:studentId')
  @FeeAccess('REPORT_ONLY')
  @ApiOperation({ summary: 'Get fee statement as-at-date (JSON)' })
  getStatement(
    @Param('studentId') studentId: string,
    @Query('asOf') asOf: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.statement.getStatement(user.tenantId, studentId, asOf);
  }

  @Get('statement/:studentId/export/pdf')
  @FeeAccess('REPORT_ONLY')
  async getStatementPdf(
    @Param('studentId') studentId: string,
    @Query('asOf') asOf: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const data = await this.statement.getStatement(
      user.tenantId,
      studentId,
      asOf,
    );
    const html = statementTemplate(data);
    const buffer = await this.pdf.renderHtml(html, { format: 'A4' });
    sendBinary(
      res,
      buffer,
      MIME.PDF,
      `statement-${data.student.admissionNumber}.pdf`,
    );
  }

  @Get(':id')
  @FeeAccess('READ_ONLY')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }
}
