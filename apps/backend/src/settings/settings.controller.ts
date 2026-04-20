/**
 * @description Settings controller - tenant-scoped and SuperAdmin cross-tenant endpoints.
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
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('catalogs')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Get currencies, timezones, locales, date formats' })
  catalogs() {
    return this.service.getCatalogs();
  }

  @Get('me')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Current user tenant settings (public read for formatting)' })
  getMine(@CurrentUser() user: any) {
    return this.service.getMySettings(user);
  }

  @Get('tenants')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'SuperAdmin: list all tenants for settings management' })
  listTenants(@CurrentUser() user: any) {
    return this.service.listTenantsForSettings(user);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Get settings (Admin: own tenant; SuperAdmin: via ?tenantId=)' })
  get(@CurrentUser() user: any, @Query('tenantId') tenantId?: string) {
    return this.service.getSettings(user, tenantId);
  }

  @Patch()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Update settings (Admin: own tenant; SuperAdmin: via ?tenantId=)' })
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: any,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.updateSettings(dto, user, tenantId);
  }

  @Get('tenant/:tenantId')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'SuperAdmin: get settings for a specific tenant' })
  getForTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.service.getSettings(user, tenantId);
  }

  @Patch('tenant/:tenantId')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'SuperAdmin: update settings for a specific tenant' })
  updateForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateSettings(dto, user, tenantId);
  }
}
