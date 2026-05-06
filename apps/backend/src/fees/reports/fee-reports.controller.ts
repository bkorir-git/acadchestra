/**
 * @description Reports controller — JSON + Excel export. Teachers get access
 *   here via REPORT_ONLY tier. Admin/Finance/Principal all allowed.
 */

import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeAccess, FeeRoleGuard } from '../common/fee-roles.guard';
import { MIME, sendBinary } from '../common/sendBinary.util';
import { FeeReportsService } from './fee-reports.service';
import {
  QueryCollectionsDto,
  QueryFeeReportsDto,
} from './dto/query-fee-reports.dto';

@ApiTags('Fee Reports')
@Controller('fees/reports')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeeReportsController {
  constructor(private readonly service: FeeReportsService) {}

  @Get('overview')
  @FeeAccess('REPORT_ONLY')
  overview(@Query() query: QueryFeeReportsDto, @CurrentUser() user: any) {
    return this.service.overview(user.tenantId, query);
  }

  @Get('by-class')
  @FeeAccess('REPORT_ONLY')
  byClass(@Query() query: QueryFeeReportsDto, @CurrentUser() user: any) {
    return this.service.byClass(user.tenantId, query);
  }

  @Get('by-term')
  @FeeAccess('REPORT_ONLY')
  byTerm(@Query() query: QueryFeeReportsDto, @CurrentUser() user: any) {
    return this.service.byTerm(user.tenantId, query);
  }

  @Get('by-category')
  @FeeAccess('REPORT_ONLY')
  byCategory(@Query() query: QueryFeeReportsDto, @CurrentUser() user: any) {
    return this.service.byCategory(user.tenantId, query);
  }

  @Get('collections')
  @FeeAccess('REPORT_ONLY')
  collections(@Query() query: QueryCollectionsDto, @CurrentUser() user: any) {
    return this.service.collections(user.tenantId, query);
  }

  @Get('student/:studentId')
  @FeeAccess('REPORT_ONLY')
  studentReport(
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.studentReport(user.tenantId, studentId);
  }

  @Get('by-class/export/xlsx')
  @FeeAccess('REPORT_ONLY')
  async exportByClass(
    @Query() query: QueryFeeReportsDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportByClassXlsx(user.tenantId, query);
    sendBinary(res, buffer, MIME.XLSX, 'by-class.xlsx');
  }

  @Get('by-term/export/xlsx')
  @FeeAccess('REPORT_ONLY')
  async exportByTerm(
    @Query() query: QueryFeeReportsDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportByTermXlsx(user.tenantId, query);
    sendBinary(res, buffer, MIME.XLSX, 'by-term.xlsx');
  }

  @Get('by-category/export/xlsx')
  @FeeAccess('REPORT_ONLY')
  async exportByCategory(
    @Query() query: QueryFeeReportsDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportByCategoryXlsx(
      user.tenantId,
      query,
    );
    sendBinary(res, buffer, MIME.XLSX, 'by-category.xlsx');
  }

  @Get('arrears/export/xlsx')
  @FeeAccess('REPORT_ONLY')
  async exportArrears(
    @Query() query: QueryFeeReportsDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportArrearsXlsx(user.tenantId, query);
    sendBinary(res, buffer, MIME.XLSX, 'arrears.xlsx');
  }
}
