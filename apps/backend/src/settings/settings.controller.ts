/**
 * @file settings.controller.ts
 * @description Sectioned settings endpoints. Per-section save = one PATCH per section.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { SectionPatchDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('catalogs')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  catalogs() {
    return this.service.getCatalogs();
  }

  @Get('me')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({
    summary: 'Current user tenant settings (public read for formatting)',
  })
  getMine(@CurrentUser() user: any) {
    return this.service.getMySettings(user);
  }

  @Get('tenants')
  @Roles('SuperAdmin')
  @ApiOperation({
    summary: 'SuperAdmin: list all tenants for settings management',
  })
  listTenants(@CurrentUser() user: any) {
    return this.service.listTenantsForSettings(user);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Get settings (Admin: own tenant; SuperAdmin: via ?tenantId=)',
  })
  get(@CurrentUser() user: any, @Query('tenantId') tenantId?: string) {
    return this.service.getSettings(user, tenantId);
  }

  /** Per-section patch — payload: { section, values }. */
  @Patch('section')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Save one section (localization | branding | communications)',
  })
  patchSection(
    @Body() dto: SectionPatchDto,
    @CurrentUser() user: any,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.patchSection(user, dto.section, dto.values, tenantId);
  }

  @Get('tenant/:tenantId')
  @Roles('SuperAdmin')
  getForTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.service.getSettings(user, tenantId);
  }

  @Patch('tenant/:tenantId/section')
  @Roles('SuperAdmin')
  patchSectionForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: SectionPatchDto,
    @CurrentUser() user: any,
  ) {
    return this.service.patchSection(user, dto.section, dto.values, tenantId);
  }
}
