/**
 * @file fee-downloads.controller.ts
 * @description Single download surface for the fee module. Mounted at
 *   `/fees/downloads`. Replaces the historical scattered download endpoints.
 *   Every response uses `sendBinary()` — no manual Content-Length, which
 *   was the source of the corrupt-PDF / unopenable-Word bug.
 *
 *   Endpoints:
 *     GET /fees/downloads/options                  — search index for the UI
 *     GET /fees/downloads/structure/:id/(pdf|word) — single structure
 *     GET /fees/downloads/year/:id/matrix/(pdf|word) — full-year matrix
 *     GET /fees/downloads/year/:id/term/:tid/class/:cid/(pdf|word) — slip
 *     GET /fees/downloads/invoice/:id/pdf          — invoice PDF
 *     GET /fees/downloads/receipt/:id/pdf          — payment receipt PDF
 */

import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FeeDownloadsService, Orientation } from './fee-downloads.service';
import { MIME, sendBinary } from '../common/sendBinary.util';
import { PdfRendererService } from './pdf-renderer.service';
import { receiptTemplate } from './templates/receipt.template';
import { PrismaService } from '../../database/prisma.service';

function slugifyForFilename(input: string): string {
  return (
    (input ?? 'download')
      .toString()
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase() || 'download'
  );
}

function pickOrientation(
  raw: string | undefined,
  fallback: Orientation,
): Orientation {
  return raw === 'portrait' || raw === 'landscape' ? raw : fallback;
}

@ApiTags('Fee Downloads')
@Controller('fees/downloads')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeeDownloadsController {
  constructor(
    private readonly service: FeeDownloadsService,
    private readonly pdf: PdfRendererService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('options')
  @FeeAccess('READ_ONLY')
  @ApiOperation({ summary: 'Search index used by the downloads UI' })
  options(
    @Query('yearId') yearId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.searchOptions(user.tenantId, yearId);
  }

  // ─── Single structure ───────────────────────────────────────────
  @Get('structure/:id/pdf')
  @FeeAccess('READ_ONLY')
  async structurePdf(
    @Param('id') id: string,
    @Query('orientation') orientation: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const orient = pickOrientation(orientation, 'portrait');
    const { buffer, filenameBase } = await this.service.structurePdf(
      user.tenantId,
      id,
      orient,
    );
    sendBinary(
      res,
      buffer,
      MIME.PDF,
      `${slugifyForFilename(filenameBase)}.pdf`,
    );
  }

  @Get('structure/:id/word')
  @FeeAccess('READ_ONLY')
  async structureWord(
    @Param('id') id: string,
    @Query('orientation') orientation: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const orient = pickOrientation(orientation, 'portrait');
    const { buffer, filenameBase } = await this.service.structureWord(
      user.tenantId,
      id,
      orient,
    );
    sendBinary(
      res,
      buffer,
      MIME.DOCX,
      `${slugifyForFilename(filenameBase)}.docx`,
    );
  }

  // ─── Year matrix ────────────────────────────────────────────────
  @Get('year/:id/matrix/pdf')
  @FeeAccess('READ_ONLY')
  async matrixPdf(
    @Param('id') id: string,
    @Query('curriculumId') curriculumId: string | undefined,
    @Query('gradeId') gradeId: string | undefined,
    @Query('classId') classId: string | undefined,
    @Query('orientation') orientation: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const orient = pickOrientation(orientation, 'landscape');
    const { buffer, filenameBase } = await this.service.yearMatrixPdf(
      user.tenantId,
      id,
      { curriculumId, gradeId, classId },
      orient,
    );
    sendBinary(
      res,
      buffer,
      MIME.PDF,
      `${slugifyForFilename(filenameBase)}.pdf`,
    );
  }

  @Get('year/:id/matrix/word')
  @FeeAccess('READ_ONLY')
  async matrixWord(
    @Param('id') id: string,
    @Query('curriculumId') curriculumId: string | undefined,
    @Query('gradeId') gradeId: string | undefined,
    @Query('classId') classId: string | undefined,
    @Query('orientation') orientation: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const orient = pickOrientation(orientation, 'landscape');
    const { buffer, filenameBase } = await this.service.yearMatrixWord(
      user.tenantId,
      id,
      { curriculumId, gradeId, classId },
      orient,
    );
    sendBinary(
      res,
      buffer,
      MIME.DOCX,
      `${slugifyForFilename(filenameBase)}.docx`,
    );
  }

  // ─── Per-class per-term slip ───────────────────────────────────
  @Get('year/:id/term/:termId/class/:classId/pdf')
  @FeeAccess('READ_ONLY')
  async classSlipPdf(
    @Param('id') yearId: string,
    @Param('termId') termId: string,
    @Param('classId') classId: string,
    @Query('orientation') orientation: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const orient = pickOrientation(orientation, 'portrait');
    const { buffer, filenameBase } = await this.service.classTermSlipPdf(
      user.tenantId,
      yearId,
      termId,
      classId,
      orient,
    );
    sendBinary(
      res,
      buffer,
      MIME.PDF,
      `${slugifyForFilename(filenameBase)}.pdf`,
    );
  }

  @Get('year/:id/term/:termId/class/:classId/word')
  @FeeAccess('READ_ONLY')
  async classSlipWord(
    @Param('id') yearId: string,
    @Param('termId') termId: string,
    @Param('classId') classId: string,
    @Query('orientation') orientation: string | undefined,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const orient = pickOrientation(orientation, 'portrait');
    const { buffer, filenameBase } = await this.service.classTermSlipWord(
      user.tenantId,
      yearId,
      termId,
      classId,
      orient,
    );
    sendBinary(
      res,
      buffer,
      MIME.DOCX,
      `${slugifyForFilename(filenameBase)}.docx`,
    );
  }

  // ─── Invoice + receipt ─────────────────────────────────────────
  @Get('invoice/:id/pdf')
  @FeeAccess('READ_ONLY')
  async invoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { buffer, filenameBase } = await this.service.invoicePdf(
      user.tenantId,
      id,
    );
    sendBinary(
      res,
      buffer,
      MIME.PDF,
      `${slugifyForFilename(filenameBase)}.pdf`,
    );
  }

  @Get('receipt/:id/pdf')
  @FeeAccess('READ_ONLY')
  async receiptPdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const payment = await this.prisma.feePayment.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        studentFee: {
          include: {
            student: { include: { class: true } },
            feeStructure: true,
          },
        },
        allocations: { include: { studentFeeComponent: true } },
      },
    });
    if (!payment) {
      res.status(404).json({ message: 'Payment not found' });
      return;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { settings: true },
    });
    const html = receiptTemplate({ payment, tenant });
    const buf = await this.pdf.renderHtml(html);
    sendBinary(
      res,
      buf,
      MIME.PDF,
      `${slugifyForFilename(`Receipt ${payment.receiptNumber}`)}.pdf`,
    );
  }
}
