/**
 * @file admission-counter.controller.ts
 * @module common/admission-counter
 * @description Admin endpoints to inspect and configure the admission counter.
 *   Issuance is internal — it happens inside StudentsService.create() inside a
 *   transaction. This controller is for visibility & migration only.

 */

import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdmissionCounterService } from './admission-counter.service';
import { UpdateAdmissionCounterDto } from './dto/admission-counter.dto';

@ApiTags('Admission Counter')
@Controller('admission-counter')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdmissionCounterController {
  constructor(private readonly service: AdmissionCounterService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Get current counter state' })
  async get(@CurrentUser() user: any) {
    return this.service.ensure(user.tenantId);
  }

  @Get('peek')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Preview the next admission number (no increment)' })
  async peek(@CurrentUser() user: any) {
    const next = await this.service.peekNext(user.tenantId);
    return { next };
  }

  @Patch()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({
    summary: 'Update counter strategy / prefix / padding / startAt',
  })
  async update(
    @Body() dto: UpdateAdmissionCounterDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(user.tenantId, dto);
  }

  @Post('rebase')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({
    summary: 'Rebase counter from existing students (migration helper)',
  })
  async rebase(@CurrentUser() user: any) {
    return this.service.rebaseFromExisting(user.tenantId);
  }
}
