/**
 * @file email.controller.ts
 * @module common/email
 * @description Admin endpoints for email operations:
 *   - Manage tenant-specific templates (override system defaults)
 *   - Inspect delivery audit
 *   - Manually retry queued emails
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { EmailService } from './email.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Email')
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('templates')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'List email templates (system + tenant overrides)' })
  async listTemplates(@CurrentUser() user: any) {
    return this.prisma.emailTemplate.findMany({
      where: {
        OR: [{ tenantId: user.tenantId }, { tenantId: null, isSystem: true }],
      },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });
  }

  @Patch('templates/:code')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({
    summary: 'Override a system template for THIS tenant (creates a copy)',
  })
  async overrideTemplate(
    @Param('code') code: string,
    @Body() body: { subject?: string; body?: string; isActive?: boolean },
    @CurrentUser() user: any,
  ) {
    const existing = await this.prisma.emailTemplate.findFirst({
      where: { code, tenantId: user.tenantId },
    });
    if (existing) {
      return this.prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: body.subject ?? existing.subject,
          body: body.body ?? existing.body,
          isActive: body.isActive ?? existing.isActive,
        },
      });
    }
    // Create a tenant override based on system default
    const system = await this.prisma.emailTemplate.findFirst({
      where: { code, tenantId: null, isSystem: true },
    });
    if (!system) throw new Error(`No system template with code "${code}"`);
    return this.prisma.emailTemplate.create({
      data: {
        code: system.code,
        name: system.name,
        description: system.description,
        subject: body.subject ?? system.subject,
        body: body.body ?? system.body,
        isHtml: system.isHtml,
        isActive: body.isActive ?? true,
        tenantId: user.tenantId,
        isSystem: false,
      },
    });
  }

  @Get('deliveries')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Audit log of every email sent for this tenant' })
  async listDeliveries(
    @CurrentUser() user: any,
    @Query('limit') limit = '50',
    @Query('status') status?: string,
  ) {
    return this.prisma.emailDelivery.findMany({
      where: {
        tenantId: user.tenantId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
  }

  @Post('queue/process')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Manually trigger queued-email dispatch' })
  async processQueue() {
    return this.emailService.processQueue(100);
  }
}
